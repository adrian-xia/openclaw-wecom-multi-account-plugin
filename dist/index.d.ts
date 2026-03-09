import * as openclaw_plugin_sdk from 'openclaw/plugin-sdk';
import { OpenClawPluginApi } from 'openclaw/plugin-sdk';

declare const plugin: {
    id: string;
    name: string;
    description: string;
    configSchema: openclaw_plugin_sdk.OpenClawPluginConfigSchema;
    register(api: OpenClawPluginApi): void;
};

export { plugin as default };
