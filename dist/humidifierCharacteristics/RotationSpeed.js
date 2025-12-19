"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const big_js_1 = __importDefault(require("big.js"));
const util_1 = require("../util");
const calculateSpeed = (device) => {
    const speed = (device.speed) * device.deviceType.speedMinStep;
    return device.isOn ? speed : 0;
};
const characteristic = {
    get: async function () {
        await this.device.updateInfo();
        return calculateSpeed(this.device);
    },
    set: async function (value) {
        const realValue = new big_js_1.default(parseInt(value.toString(), 10)).div(this.device.deviceType.speedMinStep);
        if (realValue.eq(this.device.speed)) {
            return;
        }
        const success = await this.device.setSpeed(realValue.toNumber());
        if (success && this.modeChar) {
            await (0, util_1.delay)(10);
            this.modeChar.updateValue(0);
        }
    }
};
exports.default = characteristic;
//# sourceMappingURL=RotationSpeed.js.map