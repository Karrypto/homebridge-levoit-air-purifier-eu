"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const big_js_1 = __importDefault(require("big.js"));
const VeSyncFan_1 = require("../api/VeSyncFan");
const calculateSpeed = (device) => {
    let speed = (device.speed + 1) * device.deviceType.speedMinStep;
    if (device.mode === VeSyncFan_1.Mode.Sleep) {
        speed = device.deviceType.speedMinStep;
    }
    return device.isOn ? speed : 0;
};
const characteristic = {
    get: async function () {
        await this.device.updateInfo();
        return calculateSpeed(this.device);
    },
    set: async function (value) {
        const realValue = new big_js_1.default(parseInt(value.toString(), 10)).div(this.device.deviceType.speedMinStep);
        let lastSpeed = this.device.speed;
        if (this.device.mode === VeSyncFan_1.Mode.Sleep) {
            lastSpeed = 0;
        }
        if (realValue.eq(lastSpeed + 1)) {
            return;
        }
        if (realValue.eq(1)) {
            await this.device.changeMode(VeSyncFan_1.Mode.Sleep);
        }
        else if (realValue.gt(1)) {
            await this.device.changeSpeed(realValue.toNumber() - 1);
        }
    }
};
exports.default = characteristic;
//# sourceMappingURL=RotationSpeed.js.map