import { Characteristic, Service } from 'homebridge';

import Platform, { VeSyncContext, VeSyncPlatformAccessory } from './platform';
import VeSyncHumidifier from './api/VeSyncHumidifier';
import { requireService, setAccessoryInformation } from './util';

import RelativeHumidityHumidifierThreshold from './humidifierCharacteristics/RelativeHumidityHumidifierThreshold';
import CurrentHumidifierDehumidifierState from './humidifierCharacteristics/CurrentHumidifierDehumidifierState';
import CurrentRelativeHumidity from './humidifierCharacteristics/CurrentRelativeHumidity';
import RotationSpeed from './humidifierCharacteristics/RotationSpeed';
import AutoMode from './humidifierCharacteristics/AutoMode';
import Active from './humidifierCharacteristics/Active';

export type AccessoryThisType = ThisType<{
  currentStateChar?: Characteristic;
  humidifierService: Service;
  modeChar?: Characteristic;
  device: VeSyncHumidifier;
  platform: Platform;
}>;

export default class VeSyncHumAccessory {
  public currentStateChar?: Characteristic;
  public modeChar?: Characteristic;

  private humidifierService?: Service;

  public get UUID() {
    return this.device.uuid.toString();
  }

  public async refreshState() {
    await this.device.updateInfo();

    this.currentStateChar?.updateValue(this.device.currentState);
    this.modeChar?.updateValue(this.device.mode === 'auto' ? 1 : 0);
  }

  private get device() {
    return (this.accessory.context as VeSyncContext).device as VeSyncHumidifier;
  }

  constructor(
    private readonly platform: Platform,
    private readonly accessory: VeSyncPlatformAccessory,
  ) {
    try {
      const { manufacturer, model, mac } = this.device;

      setAccessoryInformation(
        requireService(
          this.accessory.getService(this.platform.Service.AccessoryInformation),
          'AccessoryInformation'
        ),
        this.platform.Characteristic,
        {
          manufacturer,
          model,
          serialNumber: mac,
          firmwareRevision: this.device.model || '1.0.0'
        }
      );

      this.humidifierService =
        this.accessory.getService(this.platform.Service.HumidifierDehumidifier) ||
        this.accessory.addService(this.platform.Service.HumidifierDehumidifier);

      this.humidifierService.setCharacteristic(
        this.platform.Characteristic.Name,
        this.device.name
      );

      this.humidifierService
        .getCharacteristic(this.platform.Characteristic.Active)
        .onGet(Active.get.bind(this))
        .onSet(Active.set.bind(this));

      this.currentStateChar = this.humidifierService
        .getCharacteristic(this.platform.Characteristic.CurrentHumidifierDehumidifierState)
        .onGet(CurrentHumidifierDehumidifierState.get.bind(this));

      this.humidifierService
        .getCharacteristic(this.platform.Characteristic.TargetHumidifierDehumidifierState)
        .setProps({
          minValue: 1,
          maxValue: 1,
          validValueRanges: [1, 1],
          validValues: [1]
        })
        .onGet(() => {
          return this.platform.Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER;
        });

      this.humidifierService
        .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
        .onGet(CurrentRelativeHumidity.get.bind(this));

      if (this.device.deviceType.hasAutoMode) {
        this.humidifierService
          .getCharacteristic(this.platform.Characteristic.RelativeHumidityHumidifierThreshold)
          .setProps({
            maxValue: 80,
            minValue: 30,
          })
          .onGet(RelativeHumidityHumidifierThreshold.get.bind(this))
          .onSet(RelativeHumidityHumidifierThreshold.set.bind(this));

        this.modeChar = this.humidifierService.getCharacteristic(this.platform.Characteristic.SwingMode)
          .onGet(AutoMode.get.bind(this))
          .onSet(AutoMode.set.bind(this));
      }

      this.humidifierService
        .getCharacteristic(this.platform.Characteristic.RotationSpeed)
        .setProps({
          minStep: this.device.deviceType.speedMinStep,
          maxValue: 100
        })
        .onGet(RotationSpeed.get.bind(this))
        .onSet(RotationSpeed.set.bind(this));
    } catch (error: any) {
      this.platform.log.error(`Error: ${error?.message}`);
    }
  }
}
