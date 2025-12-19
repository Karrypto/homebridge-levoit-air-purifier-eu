"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const characteristic = {
    get: async function () {
        var _a;
        await this.device.updateInfo();
        const { FILTER_OK, CHANGE_FILTER } = this.platform.Characteristic.FilterChangeIndication;
        return ((_a = this.device.filterLife) !== null && _a !== void 0 ? _a : 0) <= 25 ? CHANGE_FILTER : FILTER_OK;
    }
};
exports.default = characteristic;
//# sourceMappingURL=FilterChangeIndication.js.map