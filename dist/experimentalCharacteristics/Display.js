"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("../util");
const characteristic = {
    get: async function () {
        await this.device.updateInfo();
        return this.device.screenVisible;
    },
    set: async function (value) {
        const boolValue = value;
        if (boolValue !== this.device.screenVisible) {
            const success = await this.device.setDisplay(boolValue);
            (0, util_1.assertCommandSuccess)(success, 'Set display');
        }
        else {
            await (0, util_1.delay)(10);
        }
    }
};
exports.default = characteristic;
//# sourceMappingURL=Display.js.map