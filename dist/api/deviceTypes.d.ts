export declare enum DeviceName {
    Core602S = "602S",
    Core601S = "601S",
    Core600S = "600S",
    Core401S = "401S",
    Core400S = "400S",
    Core303S = "303S",// 300S Pro
    Core302S = "302S",
    Core301S = "301S",
    Core300S = "300S",
    Core201S = "201S",
    Core200S = "200S",
    Vital100S = "V102S",
    Vital200S = "V201S"
}
export declare enum HumidifierDeviceName {
    Dual200SLeg = "Dual200S",
    Dual200S = "D301S"
}
export interface DeviceType {
    isValid: (input: string) => boolean;
    hasAirQuality: boolean;
    hasAutoMode: boolean;
    speedMinStep: number;
    speedLevels: number;
    hasPM25: boolean;
}
export type DeviceCategory = 'Core' | 'Vital';
export type HumidifierDeviceType = Omit<DeviceType, 'hasPM25' | 'hasAirQuality'> & {
    isHumidifier: true;
};
declare const deviceTypes: DeviceType[];
export declare const humidifierDeviceTypes: HumidifierDeviceType[];
export default deviceTypes;
//# sourceMappingURL=deviceTypes.d.ts.map