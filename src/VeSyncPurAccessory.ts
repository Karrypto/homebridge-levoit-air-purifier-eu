import { Characteristic, Service } from 'homebridge';

import Platform, {
  AdditionalAccessories,
  VeSyncAdditionalType,
  VeSyncContext,
  VeSyncPlatformAccessory
} from './platform';
import FilterChangeIndication from './characteristics/FilterChangeIndication';
import LockPhysicalControls from './characteristics/LockPhysicalControls';
import FilterLifeLevel from './characteristics/FilterLifeLevel';
import RotationSpeed from './characteristics/RotationSpeed';
import CurrentState from './characteristics/CurrentState';
import PM25Density from './characteristics/PM25Density';
import TargetState from './characteristics/TargetState';
import AirQuality from './characteristics/AirQuality';
import Active from './characteristics/Active';
import VeSyncFan from './api/VeSyncFan';
import { requireService, setAccessoryInformation } from './util';
import { Mode } from './api/VeSyncFan';
import { getPurifierRotationSpeed } from './characteristics/airPurifierState';

import DisplayLight from './experimentalCharacteristics/Display';

export type AccessoryThisType = ThisType<{
  airPurifierActiveCharacteristic?: Characteristic;
  airPurifierCurrentCharacteristic?: Characteristic;
  airPurifierRotationSpeedCharacteristic?: Characteristic;
  airPurifierTargetCharacteristic?: Characteristic;
  HomeAirQuality: VeSyncPurAccessory['HomeAirQuality'];
  airPurifierService: Service;
  platform: Platform;
  device: VeSyncFan;
}>;

export default class VeSyncPurAccessory {
  private HomeAirQuality = this.platform.Characteristic.AirQuality;
  public airPurifierActiveCharacteristic?: Characteristic;
  public airPurifierCurrentCharacteristic?: Characteristic;
  public airPurifierRotationSpeedCharacteristic?: Characteristic;
  public airPurifierTargetCharacteristic?: Characteristic;
  private airPurifierService?: Service;

  public get UUID() {
    return this.device.uuid.toString();
  }

  public async refreshState() {
    await this.device.updateInfo(true);

    this.airPurifierActiveCharacteristic?.updateValue(
      this.device.isOn
        ? this.platform.Characteristic.Active.ACTIVE
        : this.platform.Characteristic.Active.INACTIVE
    );
    this.airPurifierCurrentCharacteristic?.updateValue(
      this.device.isOn
        ? this.platform.Characteristic.CurrentAirPurifierState.PURIFYING_AIR
        : this.platform.Characteristic.CurrentAirPurifierState.INACTIVE
    );
    this.airPurifierRotationSpeedCharacteristic?.updateValue(
      getPurifierRotationSpeed(this.device)
    );

    if (this.device.deviceType.hasAutoMode) {
      const { AUTO, MANUAL } =
        this.platform.Characteristic.TargetAirPurifierState;

      this.airPurifierTargetCharacteristic?.updateValue(
        this.device.mode === Mode.Auto ? AUTO : MANUAL
      );
    }
  }

  private get device() {
    return (this.accessory.context as VeSyncContext).device as VeSyncFan;
  }

  constructor(
    private readonly platform: Platform,
    private readonly accessory: VeSyncPlatformAccessory,
    readonly additional: AdditionalAccessories
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

      this.airPurifierService =
        this.accessory.getService(this.platform.Service.AirPurifier) ||
        this.accessory.addService(this.platform.Service.AirPurifier);

      this.airPurifierService.setCharacteristic(
        this.platform.Characteristic.Name,
        this.device.name
      );

      const sensor = additional[VeSyncAdditionalType.Sensor];
      if (sensor) {
        setAccessoryInformation(
          requireService(
            sensor.getService(this.platform.Service.AccessoryInformation),
            'Sensor AccessoryInformation'
          ),
          this.platform.Characteristic,
          {
            manufacturer,
            model,
            serialNumber: mac
          }
        );

        const airQualitySensorService =
          sensor.getService(this.platform.Service.AirQualitySensor) ||
          sensor.addService(this.platform.Service.AirQualitySensor);

        airQualitySensorService
          .getCharacteristic(this.platform.Characteristic.AirQuality)
          .setProps({
            validValues: [
              this.HomeAirQuality.UNKNOWN,
              this.HomeAirQuality.EXCELLENT,
              this.HomeAirQuality.GOOD,
              this.HomeAirQuality.INFERIOR,
              this.HomeAirQuality.POOR
            ]
          })
          .onGet(AirQuality.get.bind(this));

        if (this.device.deviceType.hasPM25) {
          airQualitySensorService
            .getCharacteristic(this.platform.Characteristic.PM2_5Density)
            .onGet(PM25Density.get.bind(this));
        }
      }

      const legacySensor = this.accessory.getService(
        this.platform.Service.AirQualitySensor
      );

      if (legacySensor) {
        this.accessory.removeService(legacySensor);
      }

      const display = additional[VeSyncAdditionalType.Light];
      if (display) {
        setAccessoryInformation(
          requireService(
            display.getService(this.platform.Service.AccessoryInformation),
            'Display AccessoryInformation'
          ),
          this.platform.Characteristic,
          {
            manufacturer,
            model,
            serialNumber: mac
          }
        );

        const displayLightService =
          display.getService(this.platform.Service.Lightbulb) ||
          display.addService(this.platform.Service.Lightbulb);

        displayLightService
          .getCharacteristic(this.platform.Characteristic.On)
          .onGet(DisplayLight.get.bind(this))
          .onSet(DisplayLight.set.bind(this));
      }

      this.airPurifierActiveCharacteristic = this.airPurifierService
        .getCharacteristic(this.platform.Characteristic.Active)
        .onGet(Active.get.bind(this))
        .onSet(Active.set.bind(this));

      this.airPurifierCurrentCharacteristic = this.airPurifierService
        .getCharacteristic(this.platform.Characteristic.CurrentAirPurifierState)
        .onGet(CurrentState.get.bind(this));

      if (this.device.deviceType.hasAutoMode) {
        this.airPurifierTargetCharacteristic = this.airPurifierService
          .getCharacteristic(this.platform.Characteristic.TargetAirPurifierState)
          .onGet(TargetState.get.bind(this))
          .onSet(TargetState.set.bind(this));
      }

      this.airPurifierService
        .getCharacteristic(this.platform.Characteristic.LockPhysicalControls)
        .onGet(LockPhysicalControls.get.bind(this))
        .onSet(LockPhysicalControls.set.bind(this));

      this.airPurifierRotationSpeedCharacteristic = this.airPurifierService
        .getCharacteristic(this.platform.Characteristic.RotationSpeed)
        .setProps({
          minStep: this.device.deviceType.speedMinStep,
          maxValue: 100
        })
        .onGet(RotationSpeed.get.bind(this))
        .onSet(RotationSpeed.set.bind(this));

      this.airPurifierService
        .getCharacteristic(this.platform.Characteristic.FilterChangeIndication)
        .onGet(FilterChangeIndication.get.bind(this));

      this.airPurifierService
        .getCharacteristic(this.platform.Characteristic.FilterLifeLevel)
        .setProps({
          minValue: 0,
          maxValue: 100,
          minStep: 1
        })
        .onGet(FilterLifeLevel.get.bind(this));
    } catch (error: any) {
      this.platform.log.error(`Error: ${error?.message}`);
    }
  }
}
