// QUnit global type declarations
declare namespace QUnit {
    interface Config {
        autostart: boolean;
    }
    
    const config: Config;
    function start(): void;
    function module(name: string, hooks?: any): void;
    function test(name: string, callback: (assert: any) => void | Promise<void>): void;
}

declare const QUnit: typeof QUnit;
