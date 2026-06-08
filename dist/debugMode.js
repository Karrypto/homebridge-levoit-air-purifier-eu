"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DebugMode {
    constructor(_debugMode, log) {
        this._debugMode = _debugMode;
        this.log = log;
    }
    debug(...message) {
        if (!this._debugMode) {
            return;
        }
        this.log.info(`[DEBUG]: ${message.join(' ')}`);
    }
}
exports.default = DebugMode;
//# sourceMappingURL=debugMode.js.map