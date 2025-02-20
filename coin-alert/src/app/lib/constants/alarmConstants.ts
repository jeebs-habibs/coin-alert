export interface AlarmConfig {
    standardAlarmPercentage: number;
    criticalAlarmPercentage: number;
  }
  
export type AlarmType = "normal" | "critical" | null 
  
export const STANDARD_ALARM_CONFIGS = new Map<number, AlarmConfig>([
    [1, { standardAlarmPercentage: 50, criticalAlarmPercentage: 80}],
    [7, { standardAlarmPercentage: 60, criticalAlarmPercentage: 90}],
    [15, {standardAlarmPercentage: 70, criticalAlarmPercentage: 100}],
    [30, {standardAlarmPercentage: 80, criticalAlarmPercentage: 120}],
    [60, {standardAlarmPercentage: 90, criticalAlarmPercentage: 175}]
])

export const ALARM_CONFIGS_MAX = new Map<number, AlarmConfig>([
    [1, { standardAlarmPercentage: 0, criticalAlarmPercentage: 0}],
    [7, { standardAlarmPercentage: 0, criticalAlarmPercentage: 0}],
    [15, {standardAlarmPercentage: 0, criticalAlarmPercentage: 0}],
    [30, {standardAlarmPercentage: 0, criticalAlarmPercentage: 0}],
    [60, {standardAlarmPercentage: 0, criticalAlarmPercentage: 0}]
])


export const QUIETER_ALARM_CONFIGS = new Map<number, AlarmConfig>();
export const NOISIER_ALARM_CONFIGS = new Map<number, AlarmConfig>();

STANDARD_ALARM_CONFIGS.forEach((config, key) => {
QUIETER_ALARM_CONFIGS.set(key, {
    standardAlarmPercentage: config.standardAlarmPercentage * 2,
    criticalAlarmPercentage: config.criticalAlarmPercentage * 2
});
});


STANDARD_ALARM_CONFIGS.forEach((config, key) => {
NOISIER_ALARM_CONFIGS.set(key, {
    standardAlarmPercentage: config.standardAlarmPercentage / 4,
    criticalAlarmPercentage: config.criticalAlarmPercentage / 4
});
});


// export const PRESET_TO_CONFIG = new Map<string, Map<number, AlarmConfig>>([
//     ["quieter", QUIETER_ALARM_CONFIGS],
//     ["standard", STANDARD_ALARM_CONFIGS],
//     ["noisier", NOISIER_ALARM_CONFIGS]
// ])
  