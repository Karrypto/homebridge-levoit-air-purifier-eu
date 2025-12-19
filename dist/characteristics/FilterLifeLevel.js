"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const characteristic = {
    get: async function () {
        var _a;
        await this.device.updateInfo();
        return (_a = this.device.filterLife) !== null && _a !== void 0 ? _a : 0;
    }
};
exports.default = characteristic;
//# sourceMappingURL=FilterLifeLevel.js.map