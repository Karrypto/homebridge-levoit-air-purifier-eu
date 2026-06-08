"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("../util");
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
        const success = await this.device.setChildLock(boolValue);
        (0, util_1.assertCommandSuccess)(success, 'Set child lock');
    }
};
exports.default = characteristic;
//# sourceMappingURL=LockPhysicalControls.js.map