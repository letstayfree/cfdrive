declare module 'simple-mind-map' {
    interface MindMapOptions {
        el: HTMLElement | null;
        data: unknown;
        readonly?: boolean;
        layout?: string;
        theme?: string;
        scaleRatio?: number;
        mouseScaleCenterUseMousePosition?: boolean;
        enableFreeDrag?: boolean;
        fit?: boolean;
        themeConfig?: Record<string, unknown>;
        [key: string]: unknown;
    }

    interface MindMapView {
        fit(): void;
        enlarge(): void;
        narrow(): void;
    }

    class MindMap {
        view: MindMapView;
        constructor(options: MindMapOptions);
        static usePlugin(plugin: unknown): void;
        setMode(mode: 'edit' | 'readonly'): void;
        getData(): unknown;
        setData(data: unknown): void;
        destroy(): void;
        on(event: string, callback: (...args: unknown[]) => void): void;
        off(event: string, callback: (...args: unknown[]) => void): void;
        export(type: string, download?: boolean, fileName?: string): Promise<void>;
    }

    export default MindMap;
}

declare module 'simple-mind-map/src/plugins/Export.js' {
    const Export: unknown;
    export default Export;
}

declare module 'simple-mind-map/src/plugins/MiniMap.js' {
    const MiniMap: unknown;
    export default MiniMap;
}

declare module 'simple-mind-map/src/plugins/Drag.js' {
    const Drag: unknown;
    export default Drag;
}

declare module 'simple-mind-map/src/plugins/Select.js' {
    const Select: unknown;
    export default Select;
}
