import type { Service } from 'homebridge';

type CharacteristicName = Parameters<Service['setCharacteristic']>[0];
type CharacteristicRegistry = {
  Manufacturer: CharacteristicName;
  Model: CharacteristicName;
  SerialNumber: CharacteristicName;
  FirmwareRevision: CharacteristicName;
};

type AccessoryInformation = {
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareRevision?: string;
};

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const assertCommandSuccess = (success: boolean, action: string) => {
  if (!success) {
    throw new Error(`${action} failed`);
  }
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const normalizeSteppedPercentage = (
  value: unknown,
  minStep: number,
  maxValue = 100
) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  const safeStep = Math.max(1, Math.round(minStep));
  const maxStep = Math.max(1, Math.floor(maxValue / safeStep));
  const clampedValue = clamp(numericValue, 0, maxValue);

  if (clampedValue === 0) {
    return 0;
  }

  return clamp(Math.round(clampedValue / safeStep), 1, maxStep);
};

export const requireService = (service: Service | undefined, name: string) => {
  if (!service) {
    throw new Error(`${name} service is unavailable`);
  }

  return service;
};

export const setAccessoryInformation = (
  service: Service,
  characteristic: CharacteristicRegistry,
  {
    manufacturer,
    model,
    serialNumber,
    firmwareRevision
  }: AccessoryInformation
) => {
  const accessoryInformation = service
    .setCharacteristic(characteristic.Manufacturer, manufacturer)
    .setCharacteristic(characteristic.Model, model)
    .setCharacteristic(characteristic.SerialNumber, serialNumber);

  if (firmwareRevision) {
    accessoryInformation.setCharacteristic(
      characteristic.FirmwareRevision,
      firmwareRevision
    );
  }
};
