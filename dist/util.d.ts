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
export declare const delay: (ms: number) => Promise<unknown>;
export declare const assertCommandSuccess: (success: boolean, action: string) => void;
export declare const clamp: (value: number, min: number, max: number) => number;
export declare const normalizeSteppedPercentage: (value: unknown, minStep: number, maxValue?: number) => number;
export declare const requireService: (service: Service | undefined, name: string) => Service;
export declare const setAccessoryInformation: (service: Service, characteristic: CharacteristicRegistry, { manufacturer, model, serialNumber, firmwareRevision }: AccessoryInformation) => void;
export {};
//# sourceMappingURL=util.d.ts.map