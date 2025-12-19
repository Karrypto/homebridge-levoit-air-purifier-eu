import { Logger } from 'homebridge';
export default class DebugMode {
    private readonly _debugMode;
    private readonly log;
    constructor(_debugMode: boolean, log: Logger);
    debug(...message: any[]): void;
}
//# sourceMappingURL=debugMode.d.ts.map