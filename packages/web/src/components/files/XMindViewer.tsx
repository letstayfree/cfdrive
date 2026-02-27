import { useState, useEffect, useRef, useCallback } from 'react';
import { fileService } from '../../services/api';
import { parseXMind, repackXMind, getSheetData, exportToMarkdown } from '../../utils/xmindParser';
import type { DriveItem } from '../../stores/files';
import type { ParsedXMind, MindMapNode } from '../../utils/xmindParser';
import toast from 'react-hot-toast';
import {
    X, Download, Save, Edit3, Eye, ZoomIn, ZoomOut, Maximize2,
    Palette, LayoutGrid, ChevronDown, Loader2, Image as ImageIcon,
} from 'lucide-react';

// ===== 配置常量 =====

const THEMES = [
    { name: '默认', value: 'default' },
    { name: '清爽', value: 'fresh' },
    { name: '蓝调', value: 'blue' },
    { name: '绿色', value: 'green' },
    { name: '紫色', value: 'purple' },
    { name: '橙色', value: 'orange' },
    { name: '红色', value: 'red' },
    { name: '黑白', value: 'monochrome' },
];

const LAYOUTS = [
    { name: '逻辑图', value: 'logicalStructure' },
    { name: '组织结构', value: 'organizationStructure' },
    { name: '鱼骨图', value: 'fishbone' },
    { name: '时间线', value: 'timeline' },
];

const THEME_COLORS: Record<string, {
    lineColor: string;
    root: { fillColor: string; color: string; borderColor: string };
    second: { fillColor: string; color: string; borderColor: string };
    node: { fillColor: string; color: string; borderColor: string };
}> = {
    default: {
        lineColor: '#0ea5e9',
        root: { fillColor: '#0ea5e9', color: '#ffffff', borderColor: '#0284c7' },
        second: { fillColor: '#e0f2fe', color: '#0c4a6e', borderColor: '#7dd3fc' },
        node: { fillColor: '#f0f9ff', color: '#0369a1', borderColor: '#bae6fd' },
    },
    fresh: {
        lineColor: '#10b981',
        root: { fillColor: '#10b981', color: '#ffffff', borderColor: '#059669' },
        second: { fillColor: '#d1fae5', color: '#065f46', borderColor: '#6ee7b7' },
        node: { fillColor: '#f0fdf4', color: '#047857', borderColor: '#a7f3d0' },
    },
    blue: {
        lineColor: '#3b82f6',
        root: { fillColor: '#3b82f6', color: '#ffffff', borderColor: '#1d4ed8' },
        second: { fillColor: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd' },
        node: { fillColor: '#eff6ff', color: '#1e3a8a', borderColor: '#bfdbfe' },
    },
    green: {
        lineColor: '#22c55e',
        root: { fillColor: '#22c55e', color: '#ffffff', borderColor: '#16a34a' },
        second: { fillColor: '#dcfce7', color: '#166534', borderColor: '#86efac' },
        node: { fillColor: '#f7fee7', color: '#3f6212', borderColor: '#bfef45' },
    },
    purple: {
        lineColor: '#a855f7',
        root: { fillColor: '#a855f7', color: '#ffffff', borderColor: '#9333ea' },
        second: { fillColor: '#f3e8ff', color: '#6b21a8', borderColor: '#d8b4fe' },
        node: { fillColor: '#faf5ff', color: '#581c87', borderColor: '#e9d5ff' },
    },
    orange: {
        lineColor: '#f97316',
        root: { fillColor: '#f97316', color: '#ffffff', borderColor: '#ea580c' },
        second: { fillColor: '#ffedd5', color: '#92400e', borderColor: '#fed7aa' },
        node: { fillColor: '#fff7ed', color: '#b45309', borderColor: '#ffdab9' },
    },
    red: {
        lineColor: '#ef4444',
        root: { fillColor: '#ef4444', color: '#ffffff', borderColor: '#dc2626' },
        second: { fillColor: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' },
        node: { fillColor: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' },
    },
    monochrome: {
        lineColor: '#475569',
        root: { fillColor: '#1e293b', color: '#ffffff', borderColor: '#0f172a' },
        second: { fillColor: '#cbd5e1', color: '#0f172a', borderColor: '#94a3b8' },
        node: { fillColor: '#e2e8f0', color: '#1e293b', borderColor: '#64748b' },
    },
};

function getThemeConfig(theme: string, bgColor: string) {
    const colors = THEME_COLORS[theme] || THEME_COLORS.default;
    return {
        backgroundColor: bgColor,
        backgroundImage: 'none',
        lineColor: colors.lineColor,
        lineWidth: 2,
        root: { ...colors.root, borderWidth: 0, fontSize: 18, fontWeight: 'bold' },
        second: { ...colors.second, borderWidth: 1, fontSize: 14 },
        node: { ...colors.node, borderWidth: 1, fontSize: 12 },
    };
}

// ===== 组件 =====

interface XMindViewerProps {
    item: DriveItem;
    onClose: () => void;
}

import type MindMap from 'simple-mind-map';
type MindMapInstance = MindMap;

export default function XMindViewer({ item, onClose }: XMindViewerProps) {
    // 状态
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<ParsedXMind | null>(null);
    const [originalBuffer, setOriginalBuffer] = useState<ArrayBuffer | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isModified, setIsModified] = useState(false);
    const [mindMapReady, setMindMapReady] = useState(false);
    const [bgColor] = useState('#ffffff');
    const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('mindMapTheme') || 'default');
    const [currentLayout, setCurrentLayout] = useState(() => localStorage.getItem('mindMapLayout') || 'logicalStructure');
    const [showThemePicker, setShowThemePicker] = useState(false);
    const [showLayoutPicker, setShowLayoutPicker] = useState(false);
    const [showExportPicker, setShowExportPicker] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [sheets, setSheets] = useState<Array<{ id: string; title: string }>>([]);
    const [currentSheetIndex, setCurrentSheetIndex] = useState(0);

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const mindMapRef = useRef<MindMapInstance | null>(null);
    const sheetsDataRef = useRef<Record<number, MindMapNode>>({});
    const loadingRef = useRef(false); // 防止 StrictMode 重复加载

    // 加载文件
    useEffect(() => {
        if (loadingRef.current) return;
        loadingRef.current = true;

        const loadFile = async () => {
            try {
                setLoading(true);
                setError(null);

                // 获取下载链接
                const response = await fileService.getDownloadUrl(item.id);
                if (!response.success || !response.data) {
                    throw new Error('获取文件下载链接失败');
                }

                // 下载文件内容
                const fileResponse = await fetch(response.data.downloadUrl);
                if (!fileResponse.ok) throw new Error('下载文件失败');
                const arrayBuffer = await fileResponse.arrayBuffer();

                // 解析 XMind
                const parsed = await parseXMind(arrayBuffer);
                setOriginalBuffer(arrayBuffer);
                setParsedData(parsed);
                if (parsed.sheets?.length > 0) {
                    setSheets(parsed.sheets.map(s => ({ id: s.id, title: s.title })));
                }
            } catch (err) {
                console.error('Failed to load XMind:', err);
                setError(err instanceof Error ? err.message : '加载失败');
            } finally {
                setLoading(false);
            }
        };
        loadFile();
    }, [item.id]);

    // 初始化 simple-mind-map
    useEffect(() => {
        if (!parsedData || !containerRef.current) return;

        let cancelled = false;

        const initMindMap = async () => {
            try {
                const MindMap = (await import('simple-mind-map')).default;
                const Export = (await import('simple-mind-map/src/plugins/Export.js')).default;
                const MiniMap = (await import('simple-mind-map/src/plugins/MiniMap.js')).default;
                const Drag = (await import('simple-mind-map/src/plugins/Drag.js')).default;
                const Select = (await import('simple-mind-map/src/plugins/Select.js')).default;

                // StrictMode 下第一次 mount 会被立即 unmount，此时不再初始化
                if (cancelled) return;

                MindMap.usePlugin(Export);
                MindMap.usePlugin(MiniMap);
                MindMap.usePlugin(Drag);
                MindMap.usePlugin(Select);

                containerRef.current!.innerHTML = '';

                const instance = new MindMap({
                    el: containerRef.current,
                    data: parsedData.data,
                    readonly: true,
                    layout: currentLayout,
                    theme: currentTheme,
                    scaleRatio: 0.1,
                    mouseScaleCenterUseMousePosition: true,
                    enableFreeDrag: false,
                    fit: true,
                    themeConfig: getThemeConfig(currentTheme, bgColor),
                });

                mindMapRef.current = instance;

                let renderCompleted = false;
                const markReady = () => {
                    if (renderCompleted || cancelled) return;
                    renderCompleted = true;
                    try { instance.view?.fit(); } catch {}
                    setMindMapReady(true);
                };

                instance.on('node_tree_render_end', markReady);
                instance.on('draw', markReady);
                setTimeout(markReady, 500);

            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to initialize mind map:', err);
                    setError('初始化思维导图失败');
                }
            }
        };

        initMindMap();

        return () => {
            cancelled = true;
            mindMapRef.current?.destroy?.();
            mindMapRef.current = null;
            setMindMapReady(false);
        };
    }, [parsedData]);

    // 编辑模式切换
    useEffect(() => {
        if (!mindMapRef.current || !mindMapReady) return;
        mindMapRef.current.setMode(isEditing ? 'edit' : 'readonly');
    }, [isEditing, mindMapReady]);

    // 监听数据变化
    useEffect(() => {
        if (!mindMapRef.current || !isEditing) return;
        const handleDataChange = () => setIsModified(true);
        mindMapRef.current.on('data_change', handleDataChange);
        return () => { mindMapRef.current?.off('data_change', handleDataChange); };
    }, [isEditing, mindMapReady]);

    // 重新初始化（主题/布局切换时）
    const reinitialize = useCallback(async (theme: string, layout: string) => {
        if (!mindMapRef.current || !containerRef.current || !parsedData) return;

        // 保存当前数据
        const currentData = mindMapRef.current.getData() as MindMapNode;

        setMindMapReady(false);
        mindMapRef.current.destroy?.();
        mindMapRef.current = null;
        containerRef.current.innerHTML = '';

        setTimeout(async () => {
            try {
                const MindMap = (await import('simple-mind-map')).default;
                const Export = (await import('simple-mind-map/src/plugins/Export.js')).default;
                const MiniMap = (await import('simple-mind-map/src/plugins/MiniMap.js')).default;
                MindMap.usePlugin(Export);
                MindMap.usePlugin(MiniMap);

                const instance = new MindMap({
                    el: containerRef.current,
                    data: currentData,
                    readonly: !isEditing,
                    layout,
                    theme,
                    scaleRatio: 0.1,
                    mouseScaleCenterUseMousePosition: true,
                    enableFreeDrag: false,
                    fit: true,
                    themeConfig: getThemeConfig(theme, bgColor),
                });

                mindMapRef.current = instance;
                if (isEditing) instance.setMode('edit');

                const handleDraw = () => {
                    try { instance.view?.fit(); } catch {}
                    instance.off('draw', handleDraw);
                    setMindMapReady(true);
                };
                instance.on('draw', handleDraw);
                setTimeout(() => {
                    instance.off('draw', handleDraw);
                    setMindMapReady(true);
                }, 1000);
            } catch (err) {
                console.error('Reinitialize failed:', err);
            }
        }, 100);
    }, [parsedData, isEditing, bgColor]);

    // 主题切换
    const handleThemeChange = (theme: string) => {
        setCurrentTheme(theme);
        localStorage.setItem('mindMapTheme', theme);
        setShowThemePicker(false);
        reinitialize(theme, currentLayout);
    };

    // 布局切换
    const handleLayoutChange = (layout: string) => {
        setCurrentLayout(layout);
        localStorage.setItem('mindMapLayout', layout);
        setShowLayoutPicker(false);
        reinitialize(currentTheme, layout);
    };

    // 画布切换
    const handleSheetChange = (index: number) => {
        if (index === currentSheetIndex || !mindMapRef.current) return;
        sheetsDataRef.current[currentSheetIndex] = mindMapRef.current.getData() as MindMapNode;
        setCurrentSheetIndex(index);

        const cachedData = sheetsDataRef.current[index];
        if (cachedData) {
            mindMapRef.current.setData(cachedData);
        } else if (parsedData) {
            const sheetData = getSheetData(parsedData, index);
            if (sheetData) mindMapRef.current.setData(sheetData);
        }
        setTimeout(() => { mindMapRef.current?.view?.fit(); }, 200);
    };

    // 保存
    const handleSave = async () => {
        if (!mindMapRef.current || !originalBuffer) return;

        try {
            setSaving(true);
            sheetsDataRef.current[currentSheetIndex] = mindMapRef.current.getData() as MindMapNode;

            let buffer = originalBuffer;
            for (let i = 0; i < sheets.length; i++) {
                const sheetData = sheetsDataRef.current[i];
                if (sheetData) {
                    buffer = await repackXMind(buffer, sheetData, i, sheets[i]?.title);
                }
            }

            const result = await fileService.updateContent(item.id, buffer);
            if (!result.success) {
                throw new Error(result.error?.message || '保存失败');
            }
            setOriginalBuffer(buffer);
            setIsModified(false);
            toast.success('保存成功');
        } catch (err) {
            console.error('Save failed:', err);
            toast.error('保存失败');
        } finally {
            setSaving(false);
        }
    };

    // 导出
    const handleExport = async (type: string) => {
        if (!mindMapRef.current) return;
        try {
            setExporting(true);
            setShowExportPicker(false);
            const fileName = item.name.replace('.xmind', '') || 'mindmap';

            if (type === 'png') {
                await mindMapRef.current.export('png', true, fileName);
            } else if (type === 'svg') {
                await mindMapRef.current.export('svg', true, fileName);
            } else if (type === 'json') {
                const data = mindMapRef.current.getData();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${fileName}.json`;
                a.click();
                URL.revokeObjectURL(url);
            } else if (type === 'md') {
                const data = mindMapRef.current.getData() as MindMapNode;
                const md = exportToMarkdown(data);
                const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${fileName}.md`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Export failed:', err);
            toast.error('导出失败');
        } finally {
            setExporting(false);
        }
    };

    // 视图控制
    const handleZoomIn = () => mindMapRef.current?.view?.enlarge();
    const handleZoomOut = () => mindMapRef.current?.view?.narrow();
    const handleFitView = () => mindMapRef.current?.view?.fit();

    // 关闭
    const handleClose = async () => {
        if (isEditing && isModified) {
            if (confirm('文档已修改，是否要保存？')) {
                await handleSave();
            }
        }
        onClose();
    };

    // 键盘快捷键
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (isEditing) {
                    setIsEditing(false);
                } else {
                    handleClose();
                }
            }
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (isEditing) handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isEditing, isModified]);

    // ===== 渲染 =====

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 bg-white dark:bg-dark-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
                    <p className="text-dark-500">正在加载思维导图...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 z-50 bg-white dark:bg-dark-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <p className="text-red-500 text-lg">{error}</p>
                    <button onClick={onClose} className="btn btn-primary">关闭</button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-white dark:bg-dark-900 flex flex-col">
            {/* 顶部工具栏 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800">
                {/* 左侧：文件名 */}
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-medium text-dark-900 dark:text-dark-100 truncate max-w-xs">
                        {item.name}
                    </h3>
                    {isModified && (
                        <span className="text-xs text-amber-500">未保存</span>
                    )}
                </div>

                {/* 中间：工具按钮 */}
                <div className="flex items-center gap-1">
                    {/* 编辑/预览切换 */}
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            isEditing
                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600'
                                : 'hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-600 dark:text-dark-300'
                        }`}
                        title={isEditing ? '切换到预览' : '切换到编辑'}
                    >
                        {isEditing ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                        <span>{isEditing ? '预览' : '编辑'}</span>
                    </button>

                    <div className="w-px h-5 bg-dark-200 dark:bg-dark-700 mx-1" />

                    {/* 缩放 */}
                    <button onClick={handleZoomOut} className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-700" title="缩小">
                        <ZoomOut className="w-4 h-4 text-dark-500" />
                    </button>
                    <button onClick={handleZoomIn} className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-700" title="放大">
                        <ZoomIn className="w-4 h-4 text-dark-500" />
                    </button>
                    <button onClick={handleFitView} className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-700" title="适应屏幕">
                        <Maximize2 className="w-4 h-4 text-dark-500" />
                    </button>

                    <div className="w-px h-5 bg-dark-200 dark:bg-dark-700 mx-1" />

                    {/* 主题 */}
                    <div className="relative">
                        <button
                            onClick={() => { setShowThemePicker(!showThemePicker); setShowLayoutPicker(false); setShowExportPicker(false); }}
                            className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-700 text-sm text-dark-600 dark:text-dark-300"
                        >
                            <Palette className="w-4 h-4" />
                            <span>主题</span>
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {showThemePicker && (
                            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                                {THEMES.map(t => (
                                    <button
                                        key={t.value}
                                        onClick={() => handleThemeChange(t.value)}
                                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-dark-100 dark:hover:bg-dark-700 ${
                                            currentTheme === t.value ? 'text-primary-600 font-medium' : 'text-dark-600 dark:text-dark-300'
                                        }`}
                                    >
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 布局 */}
                    <div className="relative">
                        <button
                            onClick={() => { setShowLayoutPicker(!showLayoutPicker); setShowThemePicker(false); setShowExportPicker(false); }}
                            className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-700 text-sm text-dark-600 dark:text-dark-300"
                        >
                            <LayoutGrid className="w-4 h-4" />
                            <span>布局</span>
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {showLayoutPicker && (
                            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                                {LAYOUTS.map(l => (
                                    <button
                                        key={l.value}
                                        onClick={() => handleLayoutChange(l.value)}
                                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-dark-100 dark:hover:bg-dark-700 ${
                                            currentLayout === l.value ? 'text-primary-600 font-medium' : 'text-dark-600 dark:text-dark-300'
                                        }`}
                                    >
                                        {l.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 导出 */}
                    <div className="relative">
                        <button
                            onClick={() => { setShowExportPicker(!showExportPicker); setShowThemePicker(false); setShowLayoutPicker(false); }}
                            className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-700 text-sm text-dark-600 dark:text-dark-300"
                            disabled={exporting}
                        >
                            <ImageIcon className="w-4 h-4" />
                            <span>{exporting ? '导出中...' : '导出'}</span>
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {showExportPicker && (
                            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                                {[
                                    { label: 'PNG 图片', value: 'png' },
                                    { label: 'SVG 矢量', value: 'svg' },
                                    { label: 'JSON 数据', value: 'json' },
                                    { label: 'Markdown', value: 'md' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleExport(opt.value)}
                                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-600 dark:text-dark-300"
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 右侧：保存/下载/关闭 */}
                <div className="flex items-center gap-1">
                    {isEditing && (
                        <button
                            onClick={handleSave}
                            disabled={saving || !isModified}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>{saving ? '保存中...' : '保存'}</span>
                        </button>
                    )}
                    <button
                        onClick={async () => {
                            const response = await fileService.getDownloadUrl(item.id);
                            if (response.success && response.data) {
                                window.open(response.data.downloadUrl, '_blank');
                            }
                        }}
                        className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-700"
                        title="下载原文件"
                    >
                        <Download className="w-4 h-4 text-dark-500" />
                    </button>
                    <button
                        onClick={handleClose}
                        className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-700"
                        title="关闭"
                    >
                        <X className="w-4 h-4 text-dark-500" />
                    </button>
                </div>
            </div>

            {/* 思维导图容器 */}
            <div className="flex-1 relative overflow-hidden">
                {!mindMapReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-dark-900/80 z-10">
                        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                    </div>
                )}
                <div ref={containerRef} className="w-full h-full" />
            </div>

            {/* 底部：多画布 tabs */}
            {sheets.length > 1 && (
                <div className="flex items-center gap-1 px-4 py-1.5 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800 overflow-x-auto">
                    {sheets.map((sheet, index) => (
                        <button
                            key={sheet.id}
                            onClick={() => handleSheetChange(index)}
                            className={`px-3 py-1 rounded text-sm whitespace-nowrap transition-colors ${
                                index === currentSheetIndex
                                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 font-medium'
                                    : 'text-dark-500 hover:bg-dark-100 dark:hover:bg-dark-700'
                            }`}
                        >
                            {sheet.title}
                        </button>
                    ))}
                </div>
            )}

            {/* 点击空白关闭下拉菜单 */}
            {(showThemePicker || showLayoutPicker || showExportPicker) && (
                <div
                    className="fixed inset-0 z-[5]"
                    onClick={() => { setShowThemePicker(false); setShowLayoutPicker(false); setShowExportPicker(false); }}
                />
            )}
        </div>
    );
}
