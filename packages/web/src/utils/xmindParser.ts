/**
 * XMind Parser - Handles both old (XML) and new (JSON) XMind formats
 * Ported from cxmind project
 */

import JSZip from 'jszip';

// ===== Types =====

interface XMindTopic {
    id: string;
    title: string;
    note: string;
    children: XMindTopic[];
    href?: string;
    hrefTitle?: string;
    image?: { src?: string; width?: number; height?: number } | string | null;
    markers?: Array<{ markerId: string; groupId?: string; name?: string }>;
    _original?: Record<string, unknown>;
    _originalXml?: string;
}

interface XMindSheet {
    id: string;
    title: string;
    rootTopic: XMindTopic;
}

export interface MindMapNodeData {
    text: string;
    uid: string;
    note?: string;
    hyperlink?: string;
    hyperlinkTitle?: string;
    image?: string;
    imageTitle?: string;
    imageSize?: { width: number; height: number };
    icon?: string[];
}

export interface MindMapNode {
    data: MindMapNodeData;
    children: MindMapNode[];
}

export interface ParsedXMind {
    format: 'new' | 'old';
    sheets: XMindSheet[];
    data: MindMapNode;
}

// ===== Main API =====

/**
 * Parse an XMind file and return normalized data structure
 */
export async function parseXMind(arrayBuffer: ArrayBuffer): Promise<ParsedXMind> {
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Check for new format (content.json)
    const contentJson = zip.file('content.json');
    if (contentJson) {
        const content = await contentJson.async('string');
        return parseNewFormat(JSON.parse(content));
    }

    // Check for old format (content.xml)
    const contentXml = zip.file('content.xml');
    if (contentXml) {
        const content = await contentXml.async('string');
        return parseOldFormat(content);
    }

    throw new Error('Invalid XMind file: no content found');
}

/**
 * Convert simple-mind-map data back to XMind format and repack
 */
export async function repackXMind(
    originalBuffer: ArrayBuffer,
    mindMapData: MindMapNode,
    sheetIndex = 0,
    sheetTitle: string | null = null
): Promise<ArrayBuffer> {
    const zip = await JSZip.loadAsync(originalBuffer);

    const contentJson = zip.file('content.json');
    if (contentJson) {
        const content = await contentJson.async('string');
        const data = JSON.parse(content);
        const updated = updateNewFormatData(data, mindMapData, sheetIndex, sheetTitle);
        zip.file('content.json', JSON.stringify(updated));
    } else {
        const contentXml = zip.file('content.xml');
        if (contentXml) {
            const content = await contentXml.async('string');
            const updated = updateOldFormatData(content, mindMapData, sheetIndex);
            zip.file('content.xml', updated);
        }
    }

    return zip.generateAsync({ type: 'arraybuffer' });
}

/**
 * Get simple-mind-map compatible data for a specific sheet
 */
export function getSheetData(parsedData: ParsedXMind, sheetIndex: number): MindMapNode | null {
    if (!parsedData?.sheets || sheetIndex >= parsedData.sheets.length) return null;
    const sheet = parsedData.sheets[sheetIndex];
    return transformToSimpleMindMap(sheet.rootTopic);
}

/**
 * Export mind map data as Markdown
 */
export function exportToMarkdown(data: MindMapNode): string {
    const lines: string[] = [];

    function walk(node: MindMapNode, depth: number) {
        const text = node.data?.text || '';
        const note = node.data?.note || '';

        if (depth === 0) {
            lines.push(`# ${text}`);
        } else if (depth === 1) {
            lines.push(`\n## ${text}`);
        } else {
            const indent = '  '.repeat(depth - 2);
            lines.push(`${indent}- ${text}`);
        }

        if (note) {
            const noteIndent = depth <= 1 ? '' : '  '.repeat(depth - 2) + '  ';
            lines.push(`${noteIndent}> ${note}`);
        }

        if (node.children) {
            node.children.forEach(child => walk(child, depth + 1));
        }
    }

    walk(data, 0);
    return lines.join('\n');
}

// ===== Internal: New Format (JSON, XMind Zen/2020+) =====

function parseNewFormat(data: unknown): ParsedXMind {
    const sheets = Array.isArray(data) ? data : [data];
    const firstSheet = sheets[0] as Record<string, unknown>;

    if (!firstSheet || !firstSheet.rootTopic) {
        throw new Error('Invalid XMind format: no root topic found');
    }

    return {
        format: 'new',
        sheets: sheets.map((sheet: Record<string, unknown>, index: number) => ({
            id: (sheet.id as string) || `sheet-${index}`,
            title: (sheet.title as string) || `Sheet ${index + 1}`,
            rootTopic: transformNewTopic(sheet.rootTopic as Record<string, unknown>),
        })),
        data: transformToSimpleMindMap(
            transformNewTopic((firstSheet.rootTopic as Record<string, unknown>))
        ),
    };
}

function transformNewTopic(topic: Record<string, unknown>): XMindTopic {
    const notes = topic.notes as Record<string, Record<string, string>> | undefined;
    const children = topic.children as Record<string, unknown[]> | undefined;

    return {
        id: (topic.id as string) || generateId(),
        title: (topic.title as string) || '',
        note: notes?.plain?.content || '',
        children: (children?.attached || []).map(
            (child) => transformNewTopic(child as Record<string, unknown>)
        ),
        href: (topic.href as string) || '',
        hrefTitle: (topic.hrefTitle as string) || '',
        image: (topic.image as XMindTopic['image']) || null,
        markers: (topic.markers as XMindTopic['markers']) || [],
        _original: topic,
    };
}

// ===== Internal: Old Format (XML, XMind 8) =====

function parseOldFormat(xmlString: string): ParsedXMind {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    const sheets = doc.querySelectorAll('sheet');
    const parsedSheets: XMindSheet[] = [];

    sheets.forEach((sheet, index) => {
        const rootTopic = sheet.querySelector('topic');
        if (rootTopic) {
            parsedSheets.push({
                id: sheet.getAttribute('id') || `sheet-${index}`,
                title: sheet.querySelector('title')?.textContent || `Sheet ${index + 1}`,
                rootTopic: transformOldTopic(rootTopic),
            });
        }
    });

    if (parsedSheets.length === 0) {
        throw new Error('Invalid XMind format: no sheets found');
    }

    return {
        format: 'old',
        sheets: parsedSheets,
        data: transformToSimpleMindMap(parsedSheets[0].rootTopic),
    };
}

function transformOldTopic(topicElement: Element): XMindTopic {
    const titleElement = topicElement.querySelector(':scope > title');
    const notesElement = topicElement.querySelector(':scope > notes');
    const childrenContainer = topicElement.querySelector(':scope > children > topics[type="attached"]');

    const children: XMindTopic[] = [];
    if (childrenContainer) {
        childrenContainer.querySelectorAll(':scope > topic').forEach(child => {
            children.push(transformOldTopic(child));
        });
    }

    return {
        id: topicElement.getAttribute('id') || generateId(),
        title: titleElement?.textContent || '',
        note: notesElement?.textContent || '',
        children,
        _originalXml: topicElement.outerHTML,
    };
}

// ===== Internal: Transform to simple-mind-map format =====

function transformToSimpleMindMap(topic: XMindTopic): MindMapNode {
    const data: MindMapNodeData = {
        text: topic.title,
        uid: topic.id,
    };

    if (topic.note) data.note = topic.note;

    if (topic.href) {
        data.hyperlink = topic.href;
        if (topic.hrefTitle) data.hyperlinkTitle = topic.hrefTitle;
    }

    if (topic.image) {
        const img = typeof topic.image === 'string'
            ? { src: topic.image }
            : topic.image;
        if (img) {
            data.image = img.src || '';
            data.imageSize = {
                width: img.width || 100,
                height: img.height || 100,
            };
        }
    }

    if (topic.markers && topic.markers.length > 0) {
        data.icon = topic.markers.map(m => m.markerId || `${m.groupId}_${m.name}`);
    }

    return {
        data,
        children: topic.children.map(child => transformToSimpleMindMap(child)),
    };
}

// ===== Internal: Repack helpers =====

function updateNewFormatData(
    originalData: unknown,
    mindMapData: MindMapNode,
    sheetIndex: number,
    sheetTitle: string | null
): unknown[] {
    const sheets = Array.isArray(originalData)
        ? [...originalData]
        : [originalData] as Record<string, unknown>[];

    if (sheets[sheetIndex]) {
        sheets[sheetIndex] = { ...sheets[sheetIndex] as Record<string, unknown> };
        if (sheetTitle !== null) {
            (sheets[sheetIndex] as Record<string, unknown>).title = sheetTitle;
        }
        (sheets[sheetIndex] as Record<string, unknown>).rootTopic = updateTopicFromMindMap(
            (sheets[sheetIndex] as Record<string, unknown>).rootTopic as Record<string, unknown>,
            mindMapData
        );
    } else {
        while (sheets.length <= sheetIndex) {
            sheets.push({
                id: generateId(),
                class: 'sheet',
                title: '\u753B\u5E03 ' + (sheets.length + 1),
                rootTopic: mindMapNodeToXMindTopic({
                    data: { text: '\u4E2D\u5FC3\u4E3B\u9898', uid: generateId() },
                    children: [],
                }),
            });
        }
        if (sheetTitle !== null) {
            (sheets[sheetIndex] as Record<string, unknown>).title = sheetTitle;
        }
        (sheets[sheetIndex] as Record<string, unknown>).rootTopic = mindMapNodeToXMindTopic(mindMapData);
    }

    return sheets;
}

function updateTopicFromMindMap(
    originalTopic: Record<string, unknown>,
    mindMapNode: MindMapNode
): Record<string, unknown> {
    const updated = { ...originalTopic };
    const data = mindMapNode.data || {} as MindMapNodeData;

    updated.title = data.text || (originalTopic.title as string);

    if (data.note) {
        updated.notes = { plain: { content: data.note } };
    } else {
        delete updated.notes;
    }

    if (data.hyperlink) {
        updated.href = data.hyperlink;
        if (data.hyperlinkTitle) updated.hrefTitle = data.hyperlinkTitle;
    } else {
        delete updated.href;
        delete updated.hrefTitle;
    }

    if (data.image) {
        updated.image = {
            src: data.image,
            title: data.imageTitle || '',
            ...(data.imageSize ? { width: data.imageSize.width, height: data.imageSize.height } : {}),
        };
    } else {
        delete updated.image;
    }

    if (data.icon && Array.isArray(data.icon) && data.icon.length > 0) {
        updated.markers = data.icon.map(iconKey => {
            const parts = iconKey.split('_');
            return { markerId: iconKey, groupId: parts[0] || 'sign' };
        });
    } else {
        delete updated.markers;
    }

    if (mindMapNode.children && mindMapNode.children.length > 0) {
        const originalChildren = ((originalTopic.children as Record<string, unknown[]>)?.attached || []) as Record<string, unknown>[];
        updated.children = {
            attached: mindMapNode.children.map((child, index) => {
                if (originalChildren[index]) {
                    return updateTopicFromMindMap(originalChildren[index], child);
                }
                return mindMapNodeToXMindTopic(child);
            }),
        };
    } else {
        delete updated.children;
    }

    return updated;
}

function mindMapNodeToXMindTopic(mindMapNode: MindMapNode): Record<string, unknown> {
    const data = mindMapNode.data || {} as MindMapNodeData;
    const topic: Record<string, unknown> = {
        id: data.uid || generateId(),
        title: data.text || '',
    };

    if (data.note) {
        topic.notes = { plain: { content: data.note } };
    }
    if (data.hyperlink) {
        topic.href = data.hyperlink;
        if (data.hyperlinkTitle) topic.hrefTitle = data.hyperlinkTitle;
    }
    if (data.image) {
        topic.image = {
            src: data.image,
            title: data.imageTitle || '',
            ...(data.imageSize ? { width: data.imageSize.width, height: data.imageSize.height } : {}),
        };
    }
    if (data.icon && Array.isArray(data.icon) && data.icon.length > 0) {
        topic.markers = data.icon.map(iconKey => {
            const parts = iconKey.split('_');
            return { markerId: iconKey, groupId: parts[0] || 'sign' };
        });
    }

    if (mindMapNode.children && mindMapNode.children.length > 0) {
        topic.children = {
            attached: mindMapNode.children.map(child => mindMapNodeToXMindTopic(child)),
        };
    }

    return topic;
}

function updateOldFormatData(
    xmlString: string,
    mindMapData: MindMapNode,
    sheetIndex: number
): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const serializer = new XMLSerializer();

    const allSheets = doc.querySelectorAll('sheet');
    const sheet = allSheets[sheetIndex];
    if (sheet) {
        const rootTopic = sheet.querySelector('topic');
        if (rootTopic) {
            updateXmlTopic(doc, rootTopic, mindMapData);
        }
    }

    return serializer.serializeToString(doc);
}

function updateXmlTopic(doc: Document, topicElement: Element, mindMapNode: MindMapNode): void {
    let titleElement = topicElement.querySelector(':scope > title');
    if (!titleElement) {
        titleElement = doc.createElement('title');
        topicElement.insertBefore(titleElement, topicElement.firstChild);
    }
    titleElement.textContent = mindMapNode.data?.text || '';

    const childrenContainer = topicElement.querySelector(':scope > children > topics[type="attached"]');
    if (childrenContainer && mindMapNode.children) {
        const existingTopics = childrenContainer.querySelectorAll(':scope > topic');
        mindMapNode.children.forEach((child, index) => {
            if (existingTopics[index]) {
                updateXmlTopic(doc, existingTopics[index], child);
            }
        });
    }
}

function generateId(): string {
    return 'id-' + Math.random().toString(36).substring(2, 11);
}
