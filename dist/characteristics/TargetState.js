"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const VeSyncFan_1 = require("../api/VeSyncFan");
const util_1 = require("../util");
const airPurifierState_1 = require("./airPurifierState");
const characteristic = {
    get: async function () {
        const { MANUAL, AUTO } = this.platform.Characteristic.TargetAirPurifierState;
        if (!this.device.deviceType.hasAutoMode) {
            return MANUAL;
        }
        await this.device.updateInfo();
        return this.device.mode === VeSyncFan_1.Mode.Auto ? AUTO : MANUAL;
    },
    set: async function (value) {
        var _a;
        if (!this.device.deviceType.hasAutoMode) {
            return;
        }
        const { MANUAL, AUTO } = this.platform.Characteristic.TargetAirPurifierState;
        let mode;
        let action;
        switch (value) {
            case AUTO:
                mode = VeSyncFan_1.Mode.Auto;
                action = 'Set purifier auto mode';
                break;
            case MANUAL:
                mode = VeSyncFan_1.Mode.Manual;
                action = 'Set purifier manual mode';
                break;
        }
        if (!mode || !action) {
            return;
        }
        const shouldUpdatePowerState = !this.device.isOn;
        if (shouldUpdatePowerState) {
            const success = await this.device.setPower(true);
            (0, util_1.assertCommandSuccess)(success, 'Set purifier power');
        }
        if (this.device.mode !== mode) {
            const success = await this.device.changeMode(mode);
            (0, util_1.assertCommandSuccess)(success, action);
        }
        (_a = this.airPurifierTargetCharacteristic) === null || _a === void 0 ? void 0 : _a.updateValue(value);
        if (shouldUpdatePowerState) {
            (0, airPurifierState_1.updatePurifierPowerState)(this, true, (0, airPurifierState_1.getPurifierRotationSpeed)(this.device));
        }
    }
};
exports.default = characteristic;
//# sourceMappingURL=TargetState.js.map