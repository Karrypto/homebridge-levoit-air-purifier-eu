"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidSessionTerminalId = exports.isValidSessionAppId = exports.createSessionOwnerHash = exports.normalizeRefreshIntervalMs = exports.resolveBaseURLForCountry = exports.MAX_DEVICE_REFRESH_INTERVAL_MS = exports.MIN_DEVICE_REFRESH_INTERVAL_MS = exports.DEFAULT_DEVICE_REFRESH_INTERVAL_MS = exports.HumidifierBypassMethod = exports.BypassMethod = void 0;
const axios_1 = __importDefault(require("axios"));
const async_lock_1 = __importDefault(require("async-lock"));
const crypto_1 = __importDefault(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const deviceTypes_1 = __importStar(require("./deviceTypes"));
const VeSyncHumidifier_1 = __importDefault(require("./VeSyncHumidifier"));
const VeSyncFan_1 = __importDefault(require("./VeSyncFan"));
const util_1 = require("../util");
var BypassMethod;
(function (BypassMethod) {
    BypassMethod["STATUS"] = "getPurifierStatus";
    BypassMethod["MODE"] = "setPurifierMode";
    BypassMethod["NIGHT"] = "setNightLight";
    BypassMethod["DISPLAY"] = "setDisplay";
    BypassMethod["LOCK"] = "setChildLock";
    BypassMethod["SWITCH"] = "setSwitch";
    BypassMethod["SPEED"] = "setLevel";
})(BypassMethod || (exports.BypassMethod = BypassMethod = {}));
var HumidifierBypassMethod;
(function (HumidifierBypassMethod) {
    HumidifierBypassMethod["HUMIDITY"] = "setTargetHumidity";
    HumidifierBypassMethod["STATUS"] = "getHumidifierStatus";
    HumidifierBypassMethod["MIST_LEVEL"] = "setVirtualLevel";
    HumidifierBypassMethod["MODE"] = "setHumidityMode";
    HumidifierBypassMethod["DISPLAY"] = "setDisplay";
    HumidifierBypassMethod["SWITCH"] = "setSwitch";
    HumidifierBypassMethod["LEVEL"] = "setLevel";
})(HumidifierBypassMethod || (exports.HumidifierBypassMethod = HumidifierBypassMethod = {}));
const lock = new async_lock_1.default();
const VESYNC_API_BASE_URL = 'https://smartapi.vesync.com';
const VESYNC_EU_API_BASE_URL = 'https://smartapi.vesync.eu';
const ALLOWED_BASE_URLS = new Set([
    VESYNC_API_BASE_URL,
    VESYNC_EU_API_BASE_URL
]);
const APP_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TERMINAL_ID_CHARS = 'abcdef0123456789';
const APP_ID_PATTERN = /^[A-Za-z0-9]{8}$/;
const TERMINAL_ID_PATTERN = /^[a-f0-9]{16}$/;
const SESSION_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const SESSION_REFRESH_MS = 55 * 60 * 1000;
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;
exports.DEFAULT_DEVICE_REFRESH_INTERVAL_MS = 120 * 1000;
exports.MIN_DEVICE_REFRESH_INTERVAL_MS = 120 * 1000;
exports.MAX_DEVICE_REFRESH_INTERVAL_MS = 900 * 1000;
const DAILY_REQUEST_QUOTA_EXCEEDED_CODE = -16906086;
const QUOTA_PAUSE_MS = 60 * 60 * 1000;
const DEVICE_LIST_CACHE_MS = 2 * 1000;
const EU_COUNTRY_CODES = new Set([
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE',
    'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT',
    'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'NO', 'IS', 'LI', 'CH'
]);
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000, retryableErrors) => {
    var _a, _b, _c;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            const statusCode = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status;
            const errorCode = (_c = (_b = error === null || error === void 0 ? void 0 : error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.code;
            const isRetryable = statusCode === 429 ||
                statusCode === 503 ||
                statusCode === 502 ||
                statusCode === 504 ||
                (statusCode >= 500 && statusCode < 600) ||
                (retryableErrors && retryableErrors.includes(errorCode)) ||
                (error === null || error === void 0 ? void 0 : error.code) === 'ECONNRESET' ||
                (error === null || error === void 0 ? void 0 : error.code) === 'ETIMEDOUT' ||
                (error === null || error === void 0 ? void 0 : error.code) === 'ENOTFOUND';
            if (!isRetryable || attempt === maxRetries) {
                throw error;
            }
            const delayMs = baseDelay * Math.pow(2, attempt);
            await (0, util_1.delay)(delayMs);
        }
    }
    throw lastError;
};
const isTokenInvalidCode = (code) => code === -11012001 || code === -11012002;
const CROSS_REGION_ERROR_CODES = [-11260022, -11261022];
const CREDENTIAL_ERROR_CODES = [-11201129];
const REDACTED_LOG_KEYS = new Set([
    'accountid',
    'authorizecode',
    'biztoken',
    'devtoken',
    'email',
    'password',
    'tk',
    'token'
]);
function randomString(chars, length) {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(crypto_1.default.randomInt(chars.length));
    }
    return result;
}
function generateAppId() {
    return randomString(APP_ID_CHARS, 8);
}
function generateTerminalId() {
    return randomString(TERMINAL_ID_CHARS, 16);
}
function resolveBaseURLForCountry(countryCode) {
    return EU_COUNTRY_CODES.has((countryCode !== null && countryCode !== void 0 ? countryCode : 'US').toUpperCase())
        ? VESYNC_EU_API_BASE_URL
        : VESYNC_API_BASE_URL;
}
exports.resolveBaseURLForCountry = resolveBaseURLForCountry;
function normalizeRefreshIntervalMs(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return exports.DEFAULT_DEVICE_REFRESH_INTERVAL_MS;
    }
    return (0, util_1.clamp)(Math.round(value) * 1000, exports.MIN_DEVICE_REFRESH_INTERVAL_MS, exports.MAX_DEVICE_REFRESH_INTERVAL_MS);
}
exports.normalizeRefreshIntervalMs = normalizeRefreshIntervalMs;
function createSessionOwnerHash(email, countryCode) {
    return crypto_1.default
        .createHash('sha256')
        .update(`${email.trim().toLowerCase()}:${countryCode.toUpperCase()}`)
        .digest('hex');
}
exports.createSessionOwnerHash = createSessionOwnerHash;
const isValidSessionAppId = (value) => typeof value === 'string' && APP_ID_PATTERN.test(value);
exports.isValidSessionAppId = isValidSessionAppId;
const isValidSessionTerminalId = (value) => typeof value === 'string' && TERMINAL_ID_PATTERN.test(value);
exports.isValidSessionTerminalId = isValidSessionTerminalId;
function sanitizeForDebug(value) {
    if (Array.isArray(value)) {
        return value.map(sanitizeForDebug);
    }
    if (!value || typeof value !== 'object') {
        return value;
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
        key,
        REDACTED_LOG_KEYS.has(key.toLowerCase()) ? '[redacted]' : sanitizeForDebug(entry)
    ]));
}
class VeSync {
    get axiosOptions() {
        return {
            baseURL: this.baseURL,
            timeout: 30000,
            maxBodyLength: 1024 * 1024,
            maxContentLength: 1024 * 1024,
            allowAbsoluteUrls: false
        };
    }
    constructor(email, password, debugMode, log, options = {}) {
        var _a;
        this.email = email;
        this.password = password;
        this.debugMode = debugMode;
        this.log = log;
        this.options = options;
        this.unsupportedDeviceKeys = new Set();
        this.quotaPausedUntil = 0;
        this.quotaWarningLogged = false;
        this.APP_VERSION = '5.7.16';
        this.CLIENT_VERSION = `VeSync ${this.APP_VERSION}`;
        this.AGENT = 'okhttp/3.12.1';
        this.TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
        this.OS = 'Android';
        this.LANG = 'en';
        this.PHONE_BRAND = 'SM N9005';
        this.CLIENT_INFO = 'SM N9005';
        this.COUNTRY_CODE = ((_a = this.options.countryCode) !== null && _a !== void 0 ? _a : 'US').toUpperCase();
        this.sessionOwnerHash = createSessionOwnerHash(this.email, this.COUNTRY_CODE);
        this.deviceUpdateIntervalMs = normalizeRefreshIntervalMs(this.options.refreshInterval);
        this.baseURL = resolveBaseURLForCountry(this.COUNTRY_CODE);
        if (this.options.storagePath) {
            this.sessionFilePath = path.join(this.options.storagePath, '.vesync-session.json');
        }
    }
    getAlternateBaseURL() {
        return this.baseURL === VESYNC_EU_API_BASE_URL
            ? VESYNC_API_BASE_URL
            : VESYNC_EU_API_BASE_URL;
    }
    createAuthenticatedApiClient() {
        if (!this.accountId || !this.token) {
            throw new Error('Cannot create VeSync API client without authentication');
        }
        return axios_1.default.create({
            ...this.axiosOptions,
            headers: {
                'content-type': 'application/json',
                'accept-language': this.LANG,
                accountid: this.accountId,
                'user-agent': this.AGENT,
                appversion: this.APP_VERSION,
                tz: this.TIMEZONE,
                tk: this.token
            }
        });
    }
    requireApiClient() {
        if (!this.api) {
            throw new Error('The user is not logged in');
        }
        return this.api;
    }
    isQuotaPaused() {
        return Date.now() < this.quotaPausedUntil;
    }
    markQuotaExceeded(message) {
        this.quotaPausedUntil = Date.now() + QUOTA_PAUSE_MS;
        if (this.quotaWarningLogged) {
            return;
        }
        this.quotaWarningLogged = true;
        this.log.error(`VeSync daily request quota reached${message ? `: ${message}` : ''}. ` +
            'Commands and status refreshes are paused for one hour to avoid repeated rejected requests.');
    }
    handleQuotaResponse(code, message) {
        if (code !== DAILY_REQUEST_QUOTA_EXCEEDED_CODE) {
            return false;
        }
        this.markQuotaExceeded(message);
        return true;
    }
    clearQuotaPause() {
        this.quotaPausedUntil = 0;
        this.quotaWarningLogged = false;
    }
    loadPersistedSession() {
        if (!this.sessionFilePath)
            return null;
        try {
            if (fs.existsSync(this.sessionFilePath)) {
                const data = fs.readFileSync(this.sessionFilePath, 'utf8');
                const session = JSON.parse(data);
                this.loadPersistedDeviceIds(session);
                if (!this.isValidPersistedSession(session)) {
                    this.debugMode.debug('[SESSION]', 'Ignoring invalid persisted session');
                    this.clearPersistedSession();
                    return null;
                }
                if (session.expiresAt && Date.now() > (session.expiresAt - SESSION_EXPIRY_BUFFER_MS)) {
                    this.debugMode.debug('[SESSION]', 'Persisted session expired, will login fresh (keeping device IDs)');
                    this.clearPersistedSession();
                    return null;
                }
                this.debugMode.debug('[SESSION]', 'Loaded persisted session');
                return session;
            }
        }
        catch (error) {
            this.debugMode.debug('[SESSION]', 'Failed to load persisted session:', error === null || error === void 0 ? void 0 : error.message);
        }
        return null;
    }
    loadPersistedDeviceIds(session) {
        if ((0, exports.isValidSessionTerminalId)(session.terminalId)) {
            this.terminalId = session.terminalId;
        }
        if ((0, exports.isValidSessionAppId)(session.appId)) {
            this.appId = session.appId;
        }
    }
    isValidPersistedSession(session) {
        return (session.ownerHash === this.sessionOwnerHash &&
            session.countryCode === this.COUNTRY_CODE &&
            typeof session.token === 'string' &&
            session.token.length > 0 &&
            typeof session.accountId === 'string' &&
            session.accountId.length > 0 &&
            typeof session.baseURL === 'string' &&
            ALLOWED_BASE_URLS.has(session.baseURL) &&
            (session.expiresAt === undefined || typeof session.expiresAt === 'number') &&
            (session.terminalId === undefined || (0, exports.isValidSessionTerminalId)(session.terminalId)) &&
            (session.appId === undefined || (0, exports.isValidSessionAppId)(session.appId)));
    }
    saveSession() {
        if (!this.sessionFilePath || !this.token || !this.accountId)
            return;
        try {
            const session = {
                ownerHash: this.sessionOwnerHash,
                countryCode: this.COUNTRY_CODE,
                token: this.token,
                accountId: this.accountId,
                baseURL: this.baseURL,
                expiresAt: this.tokenExpiresAt,
                terminalId: this.terminalId,
                appId: this.appId
            };
            const tempFilePath = `${this.sessionFilePath}.tmp`;
            fs.writeFileSync(tempFilePath, JSON.stringify(session), {
                encoding: 'utf8',
                mode: 0o600
            });
            fs.renameSync(tempFilePath, this.sessionFilePath);
            fs.chmodSync(this.sessionFilePath, 0o600);
            this.debugMode.debug('[SESSION]', 'Session persisted (with device IDs)');
        }
        catch (error) {
            this.debugMode.debug('[SESSION]', 'Failed to persist session:', error === null || error === void 0 ? void 0 : error.message);
        }
    }
    clearPersistedSession() {
        if (!this.sessionFilePath)
            return;
        try {
            if (fs.existsSync(this.sessionFilePath)) {
                fs.unlinkSync(this.sessionFilePath);
            }
        }
        catch (error) {
            this.debugMode.debug('[SESSION]', 'Failed to clear persisted session:', error === null || error === void 0 ? void 0 : error.message);
        }
    }
    async refreshSessionForExpiredToken(errorCode, attempt) {
        if (!isTokenInvalidCode(errorCode) || attempt > 0) {
            return false;
        }
        this.clearPersistedSession();
        return this.loginInternal();
    }
    generateDetailBody() {
        return {
            appVersion: this.APP_VERSION,
            phoneBrand: this.PHONE_BRAND,
            traceId: String(Date.now()),
            phoneOS: this.OS
        };
    }
    generateBody(includeAuth = false) {
        return {
            acceptLanguage: this.LANG,
            timeZone: this.TIMEZONE,
            ...(includeAuth
                ? {
                    accountID: this.accountId,
                    token: this.token
                }
                : {})
        };
    }
    generateV2Body(fan, method, data = {}) {
        return {
            method: 'bypassV2',
            debugMode: false,
            deviceRegion: fan.region,
            cid: fan.cid,
            configModule: fan.configModule,
            payload: {
                data: {
                    ...data
                },
                method,
                source: 'APP'
            }
        };
    }
    async sendCommand(fan, method, body = {}) {
        return lock.acquire('api-call', async () => {
            var _a, _b, _c, _d;
            try {
                if (this.isQuotaPaused()) {
                    this.debugMode.debug('[SEND COMMAND]', `Skipped ${method} for ${fan.name}: VeSync quota pause active`);
                    return false;
                }
                this.debugMode.debug('[SEND COMMAND]', `${method} to ${fan.name}`);
                for (let attempt = 0; attempt < 2; attempt++) {
                    const api = this.requireApiClient();
                    const response = await retryWithBackoff(() => api.put('cloud/v2/deviceManaged/bypassV2', {
                        ...this.generateV2Body(fan, method, body),
                        ...this.generateDetailBody(),
                        ...this.generateBody(true)
                    }), 3, 1000);
                    if (!(response === null || response === void 0 ? void 0 : response.data))
                        return false;
                    if (((_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.code) === 0) {
                        await (0, util_1.delay)(500);
                        return true;
                    }
                    const errorCode = (_b = response === null || response === void 0 ? void 0 : response.data) === null || _b === void 0 ? void 0 : _b.code;
                    if (this.handleQuotaResponse(errorCode, (_c = response === null || response === void 0 ? void 0 : response.data) === null || _c === void 0 ? void 0 : _c.msg)) {
                        return false;
                    }
                    if (await this.refreshSessionForExpiredToken(errorCode, attempt)) {
                        this.debugMode.debug('[SEND COMMAND]', 'Token expired, re-login...');
                        continue;
                    }
                    this.log.error(`Command ${method} failed: ${(_d = response === null || response === void 0 ? void 0 : response.data) === null || _d === void 0 ? void 0 : _d.msg} (${errorCode})`);
                    return false;
                }
                return false;
            }
            catch (error) {
                this.log.error(`Command ${method} error:`, error === null || error === void 0 ? void 0 : error.message);
                return false;
            }
        });
    }
    async getDeviceInfo(fan, humidifier = false) {
        return lock.acquire('api-call', async () => {
            try {
                if (this.isQuotaPaused()) {
                    this.debugMode.debug('[GET DEVICE INFO]', `Skipped for ${fan.name}: VeSync quota pause active`);
                    return null;
                }
                this.debugMode.debug('[GET DEVICE INFO]', 'Fetching...');
                for (let attempt = 0; attempt < 2; attempt++) {
                    const api = this.requireApiClient();
                    const response = await retryWithBackoff(() => api.post('cloud/v2/deviceManaged/bypassV2', {
                        ...this.generateV2Body(fan, humidifier ? HumidifierBypassMethod.STATUS : BypassMethod.STATUS),
                        ...this.generateDetailBody(),
                        ...this.generateBody(true)
                    }), 3, 1000);
                    if (!(response === null || response === void 0 ? void 0 : response.data))
                        return null;
                    if (response.data.code !== 0 && response.data.code !== undefined) {
                        const errorCode = response.data.code;
                        if (this.handleQuotaResponse(errorCode, response.data.msg)) {
                            return null;
                        }
                        if (await this.refreshSessionForExpiredToken(errorCode, attempt)) {
                            continue;
                        }
                        return null;
                    }
                    await (0, util_1.delay)(500);
                    this.debugMode.debug('[GET DEVICE INFO]', 'JSON:', JSON.stringify(sanitizeForDebug(response.data)));
                    return response.data;
                }
                return null;
            }
            catch (error) {
                this.log.error(`Device info error for ${fan === null || fan === void 0 ? void 0 : fan.name}:`, error === null || error === void 0 ? void 0 : error.message);
                return null;
            }
        });
    }
    async startSession() {
        this.debugMode.debug('[START SESSION]', 'Starting auth session...');
        const persisted = this.loadPersistedSession();
        if (persisted) {
            this.token = persisted.token;
            this.accountId = persisted.accountId;
            this.baseURL = persisted.baseURL;
            this.tokenExpiresAt = persisted.expiresAt;
            this.api = this.createAuthenticatedApiClient();
            this.log.info('Reusing persisted VeSync session (no new login required)');
            this.debugMode.debug('[SESSION]', `Token expires: ${this.tokenExpiresAt ? new Date(this.tokenExpiresAt).toISOString() : 'unknown'}`);
        }
        else {
            const loginSuccess = await this.login();
            if (!loginSuccess)
                return false;
        }
        if (this.loginInterval) {
            clearInterval(this.loginInterval);
        }
        this.loginInterval = setInterval(async () => {
            this.debugMode.debug('[TOKEN REFRESH]', 'Refreshing token...');
            await this.login();
        }, SESSION_REFRESH_MS);
        return true;
    }
    stopSession() {
        if (this.loginInterval) {
            clearInterval(this.loginInterval);
            this.loginInterval = undefined;
            this.debugMode.debug('[STOP SESSION]', 'Session stopped');
        }
    }
    async login() {
        return lock.acquire('api-call', async () => this.loginInternal());
    }
    async loginInternal() {
        var _a, _b;
        try {
            if (!this.email || !this.password) {
                throw new Error('Email and password are required');
            }
            this.debugMode.debug('[LOGIN]', 'Starting new auth flow...');
            const pwdHashed = crypto_1.default.createHash('md5').update(this.password).digest('hex');
            if (!this.appId) {
                this.appId = generateAppId();
                this.debugMode.debug('[LOGIN]', 'Generated new appId');
            }
            if (!this.terminalId) {
                this.terminalId = generateTerminalId();
                this.debugMode.debug('[LOGIN]', 'Generated new terminalId');
            }
            const appId = this.appId;
            const terminalId = this.terminalId;
            const authHeaders = {
                'Content-Type': 'application/json; charset=UTF-8',
                'User-Agent': this.AGENT,
                'accept-language': this.LANG,
                'appVersion': this.APP_VERSION,
                'clientVersion': this.CLIENT_VERSION
            };
            for (const baseUrl of [this.baseURL, this.getAlternateBaseURL()]) {
                this.debugMode.debug('[LOGIN]', `Trying endpoint: ${baseUrl}`);
                const step1Body = {
                    email: this.email,
                    method: 'authByPWDOrOTM',
                    password: pwdHashed,
                    acceptLanguage: this.LANG,
                    accountID: '',
                    authProtocolType: 'generic',
                    clientInfo: this.CLIENT_INFO,
                    clientType: 'vesyncApp',
                    clientVersion: this.CLIENT_VERSION,
                    debugMode: false,
                    osInfo: this.OS,
                    terminalId: terminalId,
                    timeZone: this.TIMEZONE,
                    token: '',
                    userCountryCode: this.COUNTRY_CODE,
                    appID: appId,
                    sourceAppID: appId,
                    traceId: `APP${appId}${Math.floor(Date.now() / 1000)}`
                };
                try {
                    const step1Response = await axios_1.default.post(`${baseUrl}/globalPlatform/api/accountAuth/v1/authByPWDOrOTM`, step1Body, { headers: authHeaders, timeout: 15000 });
                    if (!(step1Response === null || step1Response === void 0 ? void 0 : step1Response.data) || step1Response.data.code !== 0) {
                        const code = (_a = step1Response === null || step1Response === void 0 ? void 0 : step1Response.data) === null || _a === void 0 ? void 0 : _a.code;
                        if (CREDENTIAL_ERROR_CODES.includes(code)) {
                            this.log.error('Login failed: Invalid email or password');
                            return false;
                        }
                        if (CROSS_REGION_ERROR_CODES.includes(code)) {
                            this.debugMode.debug('[LOGIN]', 'Cross-region error, trying alternate...');
                            continue;
                        }
                        return await this.loginLegacy(pwdHashed, baseUrl);
                    }
                    const { authorizeCode, bizToken } = step1Response.data.result || {};
                    if (!authorizeCode)
                        continue;
                    this.debugMode.debug('[LOGIN]', 'Step 1 success');
                    const step2Body = {
                        method: 'loginByAuthorizeCode4Vesync',
                        authorizeCode: authorizeCode,
                        acceptLanguage: this.LANG,
                        clientInfo: this.CLIENT_INFO,
                        clientType: 'vesyncApp',
                        clientVersion: this.CLIENT_VERSION,
                        debugMode: false,
                        emailSubscriptions: false,
                        osInfo: this.OS,
                        terminalId: terminalId,
                        timeZone: this.TIMEZONE,
                        userCountryCode: this.COUNTRY_CODE,
                        traceId: `APP${appId}${Math.floor(Date.now() / 1000)}`
                    };
                    if (bizToken)
                        step2Body.bizToken = bizToken;
                    const step2Response = await axios_1.default.post(`${baseUrl}/user/api/accountManage/v1/loginByAuthorizeCode4Vesync`, step2Body, { headers: authHeaders, timeout: 15000 });
                    if (!(step2Response === null || step2Response === void 0 ? void 0 : step2Response.data) || step2Response.data.code !== 0) {
                        const code = (_b = step2Response === null || step2Response === void 0 ? void 0 : step2Response.data) === null || _b === void 0 ? void 0 : _b.code;
                        if (CROSS_REGION_ERROR_CODES.includes(code))
                            continue;
                        continue;
                    }
                    const { token, accountID } = step2Response.data.result || {};
                    if (!token || !accountID)
                        continue;
                    this.debugMode.debug('[LOGIN]', 'Authentication successful!');
                    this.baseURL = baseUrl;
                    this.token = token;
                    this.accountId = accountID;
                    this.tokenExpiresAt = Date.now() + SESSION_TTL_MS;
                    this.api = this.createAuthenticatedApiClient();
                    this.saveSession();
                    await (0, util_1.delay)(500);
                    return true;
                }
                catch (error) {
                    this.debugMode.debug('[LOGIN]', `Request error: ${error === null || error === void 0 ? void 0 : error.message}`);
                    continue;
                }
            }
            this.log.error('Login failed: Could not authenticate with any endpoint');
            return false;
        }
        catch (error) {
            this.log.error('Login failed:', error === null || error === void 0 ? void 0 : error.message);
            return false;
        }
    }
    async loginLegacy(pwdHashed, baseUrl) {
        this.debugMode.debug('[LOGIN LEGACY]', 'Trying legacy login...');
        try {
            const response = await axios_1.default.post(`${baseUrl}/cloud/v1/user/login`, {
                email: this.email,
                password: pwdHashed,
                devToken: '',
                userType: 1,
                method: 'login',
                token: '',
                ...this.generateDetailBody(),
                ...this.generateBody()
            }, {
                headers: {
                    'content-type': 'application/json',
                    'accept-language': this.LANG,
                    'user-agent': this.AGENT,
                    appversion: this.APP_VERSION,
                    tz: this.TIMEZONE,
                },
                timeout: 15000
            });
            if (!(response === null || response === void 0 ? void 0 : response.data) || (response.data.code !== 0 && response.data.code !== undefined)) {
                return false;
            }
            const { token, accountID } = response.data.result || {};
            if (!token || !accountID)
                return false;
            this.debugMode.debug('[LOGIN LEGACY]', 'Success!');
            this.baseURL = baseUrl;
            this.token = token;
            this.accountId = accountID;
            this.tokenExpiresAt = Date.now() + SESSION_TTL_MS;
            this.api = this.createAuthenticatedApiClient();
            this.saveSession();
            await (0, util_1.delay)(500);
            return true;
        }
        catch (error) {
            this.debugMode.debug('[LOGIN LEGACY]', 'Error:', error === null || error === void 0 ? void 0 : error.message);
            return false;
        }
    }
    async fetchDeviceList() {
        var _a, _b;
        for (let attempt = 0; attempt < 2; attempt++) {
            const api = this.requireApiClient();
            const response = await retryWithBackoff(() => api.post('cloud/v2/deviceManaged/devices', {
                method: 'devices',
                pageNo: 1,
                pageSize: 1000,
                ...this.generateDetailBody(),
                ...this.generateBody(true)
            }), 3, 1000);
            if (!(response === null || response === void 0 ? void 0 : response.data)) {
                return null;
            }
            if (response.data.code !== 0 && response.data.code !== undefined) {
                const errorCode = response.data.code;
                if (this.handleQuotaResponse(errorCode, response.data.msg)) {
                    return null;
                }
                if (await this.refreshSessionForExpiredToken(errorCode, attempt)) {
                    continue;
                }
                return null;
            }
            if (!Array.isArray((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.result) === null || _b === void 0 ? void 0 : _b.list)) {
                return null;
            }
            this.clearQuotaPause();
            return response.data.result.list;
        }
        return null;
    }
    async requestDeviceList() {
        if (this.isQuotaPaused()) {
            this.debugMode.debug('[GET DEVICES]', 'Skipped device list request: VeSync quota pause active');
            return null;
        }
        const now = Date.now();
        if (this.deviceListCache && now < this.deviceListCache.expiresAt) {
            return this.deviceListCache.list;
        }
        if (this.deviceListRequest) {
            return this.deviceListRequest;
        }
        this.deviceListRequest = this.fetchDeviceList();
        try {
            const list = await this.deviceListRequest;
            if (list) {
                this.deviceListCache = {
                    list,
                    expiresAt: Date.now() + DEVICE_LIST_CACHE_MS
                };
            }
            return list;
        }
        finally {
            this.deviceListRequest = undefined;
        }
    }
    async getDeviceSnapshot(fan) {
        return lock.acquire('api-call', async () => {
            var _a;
            try {
                const list = await this.requestDeviceList();
                return (_a = list === null || list === void 0 ? void 0 : list.find(({ cid, uuid, macID }) => cid === fan.cid ||
                    uuid === fan.uuid ||
                    macID === fan.mac)) !== null && _a !== void 0 ? _a : null;
            }
            catch (error) {
                this.debugMode.debug('[GET DEVICE SNAPSHOT]', `Error for ${fan.name}:`, error === null || error === void 0 ? void 0 : error.message);
                return null;
            }
        });
    }
    async getDevices() {
        return lock.acquire('api-call', async () => {
            try {
                const list = await this.requestDeviceList();
                if (!list) {
                    return { purifiers: [], humidifiers: [] };
                }
                this.debugMode.debug('[GET DEVICES]', 'Device List:', JSON.stringify(list.map(({ deviceName, deviceType, type }) => ({
                    deviceName,
                    deviceType,
                    type
                }))));
                this.logUnsupportedDevices(list);
                let purifiers = list
                    .filter(({ deviceType, type, extension }) => deviceTypes_1.default.some(({ isValid }) => isValid(deviceType)) &&
                    type === 'wifi-air' &&
                    (extension === null || extension === void 0 ? void 0 : extension.fanSpeedLevel) !== undefined)
                    .map(VeSyncFan_1.default.fromResponse(this));
                purifiers = purifiers.concat(list
                    .filter(({ deviceType, type, deviceProp }) => deviceTypes_1.default.some(({ isValid }) => isValid(deviceType)) &&
                    type === 'wifi-air' &&
                    Boolean(deviceProp))
                    .map((fan) => ({
                    ...fan,
                    extension: {
                        ...fan.deviceProp,
                        airQualityLevel: fan.deviceProp.AQLevel,
                        mode: fan.deviceProp.workMode
                    }
                }))
                    .map(VeSyncFan_1.default.fromResponse(this)));
                const humidifiers = list
                    .filter(({ deviceType, type, extension }) => deviceTypes_1.humidifierDeviceTypes.some(({ isValid }) => isValid(deviceType)) &&
                    type === 'wifi-air' &&
                    !extension)
                    .map(VeSyncHumidifier_1.default.fromResponse(this));
                await (0, util_1.delay)(1500);
                return { purifiers, humidifiers };
            }
            catch (error) {
                this.log.error('Failed to get devices:', error === null || error === void 0 ? void 0 : error.message);
                return { purifiers: [], humidifiers: [] };
            }
        });
    }
    logUnsupportedDevices(devices) {
        devices
            .filter(({ deviceType, type }) => type === 'wifi-air' &&
            !deviceTypes_1.default.some(({ isValid }) => isValid(deviceType)) &&
            !deviceTypes_1.humidifierDeviceTypes.some(({ isValid }) => isValid(deviceType)))
            .forEach(({ deviceName, deviceType, uuid }) => {
            var _a;
            const key = `${deviceType !== null && deviceType !== void 0 ? deviceType : 'unknown'}:${(_a = uuid !== null && uuid !== void 0 ? uuid : deviceName) !== null && _a !== void 0 ? _a : 'unknown'}`;
            if (this.unsupportedDeviceKeys.has(key)) {
                return;
            }
            this.unsupportedDeviceKeys.add(key);
            this.log.warn(`Unsupported VeSync air device ignored: ${deviceName !== null && deviceName !== void 0 ? deviceName : 'Unknown'} (${deviceType !== null && deviceType !== void 0 ? deviceType : 'unknown'}, ${uuid !== null && uuid !== void 0 ? uuid : 'no uuid'})`);
        });
    }
}
exports.default = VeSync;
//# sourceMappingURL=VeSync.js.map