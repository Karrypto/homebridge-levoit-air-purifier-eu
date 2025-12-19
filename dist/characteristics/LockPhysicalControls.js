"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const characteristic = {
    get: async function () {
        await this.device.updateInfo();
        const { CONTROL_LOCK_DISABLED, CONTROL_LOCK_ENABLED } = this.platform.Characteristic.LockPhysicalControls;
        return this.device.childLock ? CONTROL_LOCK_ENABLED : CONTROL_LOCK_DISABLED;
    },
    set: async function (value) {
        const boolValue = value === 1;
        if (boolValue === this.device.childLock) {
            return;
        }
        await this.device.setChildLock(boolValue);
    }
};
exports.default = characteristic;
//# sourceMappingURL=LockPhysicalControls.js.map