"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("../util");
const characteristic = {
    get: async function () {
        await this.device.updateInfo();
        return this.device.screenVisible;
    },
    set: async function (value) {
        let boolValue = value;
        if (boolValue !== this.device.screenVisible) {
            const success = await this.device.setDisplay(boolValue);
            if (!success) {
                boolValue = !boolValue;
            }
        }
        else {
            await (0, util_1.delay)(10);
        }
        this.airPurifierCurrentCharacteristic.updateValue(boolValue);
    }
};
exports.default = characteristic;
//# sourceMappingURL=Display.js.map