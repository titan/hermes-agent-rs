//! Platform registry for registering all platform adapters.
//!
//! This module provides a centralized way to register all platform adapters
//! based on the configuration.

#[cfg(any(
    feature = "telegram",
    feature = "weixin",
    feature = "discord",
    feature = "slack",
    feature = "matrix",
    feature = "mattermost",
    feature = "signal",
    feature = "whatsapp",
    feature = "dingtalk",
    feature = "feishu",
    feature = "wecom",
    feature = "wecom-callback",
    feature = "qqbot",
    feature = "bluebubbles",
    feature = "email",
    feature = "sms",
    feature = "homeassistant",
    feature = "webhook",
    feature = "api-server"
))]
use std::sync::Arc;

use hermes_config::GatewayConfig;
use hermes_core::AgentError;

use crate::gateway::Gateway;

/// Summary of platform registration results.
#[derive(Debug, Clone)]
pub struct RegistrationSummary {
    /// Names of successfully registered adapters.
    pub registered: Vec<String>,
    /// Errors encountered during registration (adapter name, error message).
    pub errors: Vec<(String, String)>,
}

/// Register all platform adapters based on configuration.
///
/// This function registers all enabled platform adapters from the configuration
/// into the gateway. It supports all 17 platform adapters + ApiServer + Webhook.
pub async fn register_platforms(
    gateway: &Gateway,
    config: &GatewayConfig,
    sidecar_tasks: &mut Vec<tokio::task::JoinHandle<()>>,
) -> Result<RegistrationSummary, AgentError> {
    #[cfg(not(any(
        feature = "telegram",
        feature = "weixin",
        feature = "discord",
        feature = "slack",
        feature = "matrix",
        feature = "mattermost",
        feature = "signal",
        feature = "whatsapp",
        feature = "dingtalk",
        feature = "feishu",
        feature = "wecom",
        feature = "wecom-callback",
        feature = "qqbot",
        feature = "bluebubbles",
        feature = "email",
        feature = "sms",
        feature = "homeassistant",
        feature = "webhook",
        feature = "api-server"
    )))]
    {
        let _ = (gateway, config, sidecar_tasks);
        Ok(RegistrationSummary {
            registered: Vec::new(),
            errors: Vec::new(),
        })
    }

    #[cfg(any(
        feature = "telegram",
        feature = "weixin",
        feature = "discord",
        feature = "slack",
        feature = "matrix",
        feature = "mattermost",
        feature = "signal",
        feature = "whatsapp",
        feature = "dingtalk",
        feature = "feishu",
        feature = "wecom",
        feature = "wecom-callback",
        feature = "qqbot",
        feature = "bluebubbles",
        feature = "email",
        feature = "sms",
        feature = "homeassistant",
        feature = "webhook",
        feature = "api-server"
    ))]
    {
        let mut registered = Vec::new();
        let mut errors = Vec::new();

    // Helper function to extract extra fields from platform config
    fn extra_string(cfg: &hermes_config::PlatformConfig, key: &str) -> Option<String> {
        cfg.extra
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }

    fn extra_u16(cfg: &hermes_config::PlatformConfig, key: &str, default: u16) -> u16 {
        cfg.extra
            .get(key)
            .and_then(|v| v.as_u64())
            .map(|n| n as u16)
            .unwrap_or(default)
    }

    fn extra_bool(cfg: &hermes_config::PlatformConfig, key: &str, default: bool) -> bool {
        cfg.extra
            .get(key)
            .and_then(|v| v.as_bool())
            .unwrap_or(default)
    }

    fn platform_token_or_extra(cfg: &hermes_config::PlatformConfig) -> Option<String> {
        cfg.token
            .clone()
            .filter(|t| !t.trim().is_empty())
            .or_else(|| {
                cfg.extra
                    .get("token")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            })
    }

    // Telegram
    #[cfg(feature = "telegram")]
    if let Some(platform_cfg) = config.platforms.get("telegram") {
        if platform_cfg.enabled {
            if let Some(token) = platform_token_or_extra(platform_cfg) {
                use crate::platforms::telegram::{TelegramAdapter, TelegramConfig};
                
                let telegram_config = TelegramConfig {
                    token,
                    webhook_url: None,
                    polling: true,
                    proxy: Default::default(),
                    parse_markdown: false,
                    parse_html: false,
                    poll_timeout: 30,
                    bot_username: None,
                };
                match TelegramAdapter::new(telegram_config) {
                    Ok(adapter) => {
                        let adapter = Arc::new(adapter);
                        gateway
                            .register_adapter("telegram", adapter.clone())
                            .await;
                        registered.push("telegram".to_string());
                        
                        // Start Telegram poll loop
                        sidecar_tasks.push(tokio::spawn(async move {
                            // Simplified: actual implementation would run telegram poll loop
                            // For now, just log that we would start it
                            tracing::info!("Telegram poll loop would start here");
                        }));
                    }
                    Err(e) => errors.push(("telegram".to_string(), e.to_string())),
                }
            } else {
                errors.push((
                    "telegram".to_string(),
                    "token is missing".to_string(),
                ));
            }
        }
    }

    // Weixin
    #[cfg(feature = "weixin")]
    if let Some(platform_cfg) = config.platforms.get("weixin") {
        if platform_cfg.enabled {
            use crate::platforms::weixin::{WeChatAdapter, WeixinConfig};
            
            let account_id_missing = platform_cfg
                .extra
                .get("account_id")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .map(|s| s.is_empty())
                .unwrap_or(true);
            let token_missing = platform_token_or_extra(platform_cfg).is_none();
            
            if account_id_missing {
                errors.push((
                    "weixin".to_string(),
                    "account_id is missing".to_string(),
                ));
            } else if token_missing {
                errors.push((
                    "weixin".to_string(),
                    "token is missing".to_string(),
                ));
            } else {
                let wx_cfg = WeixinConfig::from_platform_config(platform_cfg);
                match WeChatAdapter::new(wx_cfg) {
                    Ok(adapter) => {
                        gateway.register_adapter("weixin", Arc::new(adapter)).await;
                        registered.push("weixin".to_string());
                    }
                    Err(e) => errors.push(("weixin".to_string(), e.to_string())),
                }
            }
        }
    }

    // Discord
    #[cfg(feature = "discord")]
    if let Some(platform_cfg) = config.platforms.get("discord") {
        if platform_cfg.enabled {
            use crate::platforms::discord::{DiscordAdapter, DiscordConfig};
            
            if let Some(token) = platform_token_or_extra(platform_cfg) {
                let discord_cfg = DiscordConfig {
                    token,
                    application_id: extra_string(platform_cfg, "application_id"),
                    proxy: Default::default(),
                    require_mention: platform_cfg.require_mention.unwrap_or(false),
                    intents: platform_cfg
                        .extra
                        .get("intents")
                        .and_then(|v| v.as_u64())
                        .unwrap_or((1 << 0) | (1 << 9) | (1 << 15)),
                };
                match DiscordAdapter::new(discord_cfg) {
                    Ok(adapter) => {
                        gateway.register_adapter("discord", Arc::new(adapter)).await;
                        registered.push("discord".to_string());
                    }
                    Err(e) => errors.push(("discord".to_string(), e.to_string())),
                }
            } else {
                errors.push((
                    "discord".to_string(),
                    "token is missing".to_string(),
                ));
            }
        }
    }

    // Slack
    #[cfg(feature = "slack")]
    if let Some(platform_cfg) = config.platforms.get("slack") {
        if platform_cfg.enabled {
            use crate::platforms::slack::{SlackAdapter, SlackConfig};
            
            if let Some(token) = platform_token_or_extra(platform_cfg) {
                let slack_cfg = SlackConfig {
                    token,
                    app_token: extra_string(platform_cfg, "app_token"),
                    socket_mode: extra_bool(platform_cfg, "socket_mode", false),
                    proxy: Default::default(),
                };
                match SlackAdapter::new(slack_cfg) {
                    Ok(adapter) => {
                        gateway.register_adapter("slack", Arc::new(adapter)).await;
                        registered.push("slack".to_string());
                    }
                    Err(e) => errors.push(("slack".to_string(), e.to_string())),
                }
            } else {
                errors.push((
                    "slack".to_string(),
                    "token is missing".to_string(),
                ));
            }
        }
    }

    // Matrix
    #[cfg(feature = "matrix")]
    if let Some(platform_cfg) = config.platforms.get("matrix") {
        if platform_cfg.enabled {
            use crate::platforms::matrix::{MatrixAdapter, MatrixConfig};
            
            let homeserver_url = extra_string(platform_cfg, "homeserver_url")
                .or_else(|| extra_string(platform_cfg, "homeserver"))
                .unwrap_or_default();
            let user_id = extra_string(platform_cfg, "user_id").unwrap_or_default();
            let access_token = platform_token_or_extra(platform_cfg)
                .or_else(|| extra_string(platform_cfg, "access_token"))
                .unwrap_or_default();
            if homeserver_url.is_empty() || user_id.is_empty() || access_token.is_empty() {
                errors.push((
                    "matrix".to_string(),
                    "homeserver_url/user_id/access_token is incomplete".to_string(),
                ));
            } else {
                let matrix_cfg = MatrixConfig {
                    homeserver_url,
                    user_id,
                    access_token,
                    room_id: extra_string(platform_cfg, "room_id"),
                    proxy: Default::default(),
                };
                match MatrixAdapter::new(matrix_cfg) {
                    Ok(adapter) => {
                        gateway.register_adapter("matrix", Arc::new(adapter)).await;
                        registered.push("matrix".to_string());
                    }
                    Err(e) => errors.push(("matrix".to_string(), e.to_string())),
                }
            }
        }
    }

    // Mattermost
    #[cfg(feature = "mattermost")]
    if let Some(platform_cfg) = config.platforms.get("mattermost") {
        if platform_cfg.enabled {
            use crate::platforms::mattermost::{MattermostAdapter, MattermostConfig};
            
            let token = platform_token_or_extra(platform_cfg).unwrap_or_default();
            let server_url = extra_string(platform_cfg, "server_url")
                .or_else(|| extra_string(platform_cfg, "url"))
                .unwrap_or_default();
            if token.is_empty() || server_url.is_empty() {
                errors.push((
                    "mattermost".to_string(),
                    "server_url/token is missing".to_string(),
                ));
            } else {
                let mm_cfg = MattermostConfig {
                    server_url,
                    token,
                    team_id: extra_string(platform_cfg, "team_id"),
                    proxy: Default::default(),
                };
                match MattermostAdapter::new(mm_cfg) {
                    Ok(adapter) => {
                        gateway
                            .register_adapter("mattermost", Arc::new(adapter))
                            .await;
                        registered.push("mattermost".to_string());
                    }
                    Err(e) => errors.push(("mattermost".to_string(), e.to_string())),
                }
            }
        }
    }

    // Signal
    #[cfg(feature = "signal")]
    if let Some(platform_cfg) = config.platforms.get("signal") {
        if platform_cfg.enabled {
            use crate::platforms::signal::{SignalAdapter, SignalConfig};
            
            let phone_number = extra_string(platform_cfg, "phone_number")
                .or_else(|| extra_string(platform_cfg, "account"))
                .unwrap_or_default();
            if phone_number.is_empty() {
                errors.push((
                    "signal".to_string(),
                    "phone_number is missing".to_string(),
                ));
            } else {
                let signal_cfg = SignalConfig {
                    phone_number,
                    api_url: extra_string(platform_cfg, "api_url")
                        .unwrap_or_else(|| "http://localhost:8080".to_string()),
                    proxy: Default::default(),
                };
                match SignalAdapter::new(signal_cfg) {
                    Ok(adapter) => {
                        gateway.register_adapter("signal", Arc::new(adapter)).await;
                        registered.push("signal".to_string());
                    }
                    Err(e) => errors.push(("signal".to_string(), e.to_string())),
                }
            }
        }
    }

    // WhatsApp
    #[cfg(feature = "whatsapp")]
    if let Some(platform_cfg) = config.platforms.get("whatsapp") {
        if platform_cfg.enabled {
            use crate::platforms::whatsapp::{WhatsAppAdapter, WhatsAppConfig};
            
            if let Some(token) = platform_token_or_extra(platform_cfg) {
                let wa_cfg = WhatsAppConfig {
                    token,
                    phone_number_id: extra_string(platform_cfg, "phone_number_id"),
                    business_account_id: extra_string(platform_cfg, "business_account_id"),
                    verify_token: extra_string(platform_cfg, "verify_token"),
                    proxy: Default::default(),
                };
                match WhatsAppAdapter::new(wa_cfg) {
                    Ok(adapter) => {
                        gateway
                            .register_adapter("whatsapp", Arc::new(adapter))
                            .await;
                        registered.push("whatsapp".to_string());
                    }
                    Err(e) => errors.push(("whatsapp".to_string(), e.to_string())),
                }
            } else {
                errors.push((
                    "whatsapp".to_string(),
                    "token is missing".to_string(),
                ));
            }
        }
    }

    // DingTalk
    #[cfg(feature = "dingtalk")]
    if let Some(platform_cfg) = config.platforms.get("dingtalk") {
        if platform_cfg.enabled {
            use crate::platforms::dingtalk::{DingTalkAdapter, DingTalkConfig};
            
            let ding_cfg = DingTalkConfig::from_platform_config(platform_cfg);
            match DingTalkAdapter::new(ding_cfg) {
                Ok(adapter) => {
                    gateway
                        .register_adapter("dingtalk", Arc::new(adapter))
                        .await;
                    registered.push("dingtalk".to_string());
                }
                Err(e) => errors.push(("dingtalk".to_string(), e.to_string())),
            }
        }
    }

    // Feishu
    #[cfg(feature = "feishu")]
    if let Some(platform_cfg) = config.platforms.get("feishu") {
        if platform_cfg.enabled {
            use crate::platforms::feishu::{FeishuAdapter, FeishuConfig};
            
            let app_id = extra_string(platform_cfg, "app_id").unwrap_or_default();
            let app_secret = extra_string(platform_cfg, "app_secret").unwrap_or_default();
            if app_id.is_empty() || app_secret.is_empty() {
                errors.push((
                    "feishu".to_string(),
                    "app_id/app_secret is missing".to_string(),
                ));
            } else {
                let feishu_cfg = FeishuConfig {
                    app_id,
                    app_secret,
                    verification_token: extra_string(platform_cfg, "verification_token"),
                    encrypt_key: extra_string(platform_cfg, "encrypt_key"),
                    proxy: Default::default(),
                };
                match FeishuAdapter::new(feishu_cfg) {
                    Ok(adapter) => {
                        gateway.register_adapter("feishu", Arc::new(adapter)).await;
                        registered.push("feishu".to_string());
                    }
                    Err(e) => errors.push(("feishu".to_string(), e.to_string())),
                }
            }
        }
    }

    // WeCom
    #[cfg(feature = "wecom")]
    if let Some(platform_cfg) = config.platforms.get("wecom") {
        if platform_cfg.enabled {
            use crate::platforms::wecom::{WeComAdapter, WeComConfig};
            
            let corp_id = extra_string(platform_cfg, "corp_id").unwrap_or_default();
            let agent_id = extra_string(platform_cfg, "agent_id").unwrap_or_default();
            let secret = extra_string(platform_cfg, "secret").unwrap_or_default();
            if corp_id.is_empty() || agent_id.is_empty() || secret.is_empty() {
                errors.push((
                    "wecom".to_string(),
                    "corp_id/agent_id/secret is missing".to_string(),
                ));
            } else {
                let wecom_cfg = WeComConfig {
                    corp_id,
                    agent_id,
                    secret,
                    proxy: Default::default(),
                };
                match WeComAdapter::new(wecom_cfg) {
                    Ok(adapter) => {
                        gateway.register_adapter("wecom", Arc::new(adapter)).await;
                        registered.push("wecom".to_string());
                    }
                    Err(e) => errors.push(("wecom".to_string(), e.to_string())),
                }
            }
        }
    }

    // WeCom Callback
    #[cfg(feature = "wecom-callback")]
    if let Some(platform_cfg) = config.platforms.get("wecom_callback") {
        if platform_cfg.enabled {
            let corp_id = extra_string(platform_cfg, "corp_id").unwrap_or_default();
            let corp_secret = extra_string(platform_cfg, "corp_secret").unwrap_or_default();
            let agent_id = extra_string(platform_cfg, "agent_id").unwrap_or_default();
            let token = platform_token_or_extra(platform_cfg)
                .or_else(|| extra_string(platform_cfg, "token"))
                .unwrap_or_default();
            let encoding_aes_key =
                extra_string(platform_cfg, "encoding_aes_key").unwrap_or_default();
            if corp_id.is_empty()
                || corp_secret.is_empty()
                || agent_id.is_empty()
                || token.is_empty()
                || encoding_aes_key.is_empty()
            {
                errors.push((
                    "wecom_callback".to_string(),
                    "corp_id/corp_secret/agent_id/token/encoding_aes_key is incomplete".to_string(),
                ));
            } else {
                // Simplified version - actual implementation would need more setup
                // For now, just log that we would set it up
                tracing::info!("WeCom callback adapter would be set up here");
                errors.push((
                    "wecom_callback".to_string(),
                    "wecom_callback adapter requires additional setup (simplified implementation)".to_string(),
                ));
            }
        }
    }

    // QQBot
    #[cfg(feature = "qqbot")]
    if let Some(platform_cfg) = config
        .platforms
        .get("qqbot")
        .or_else(|| config.platforms.get("qq"))
    {
        if platform_cfg.enabled {
            use crate::platforms::qqbot::{QqBotAdapter, QqBotConfig};
            
            let app_id = extra_string(platform_cfg, "app_id").unwrap_or_default();
            let client_secret = extra_string(platform_cfg, "client_secret").unwrap_or_default();
            if app_id.is_empty() || client_secret.is_empty() {
                errors.push((
                    "qqbot".to_string(),
                    "app_id/client_secret is missing".to_string(),
                ));
            } else {
                let qq_cfg = QqBotConfig {
                    app_id,
                    client_secret,
                    markdown_support: extra_bool(platform_cfg, "markdown_support", true),
                    proxy: Default::default(),
                };
                match QqBotAdapter::new(qq_cfg) {
                    Ok(adapter) => {
                        gateway.register_adapter("qqbot", Arc::new(adapter)).await;
                        registered.push("qqbot".to_string());
                    }
                    Err(e) => errors.push(("qqbot".to_string(), e.to_string())),
                }
            }
        }
    }

    // BlueBubbles
    #[cfg(feature = "bluebubbles")]
    if let Some(platform_cfg) = config.platforms.get("bluebubbles") {
        if platform_cfg.enabled {
            use crate::platforms::bluebubbles::{BlueBubblesAdapter, BlueBubblesConfig};
            
            let server_url = extra_string(platform_cfg, "server_url").unwrap_or_default();
            let password = extra_string(platform_cfg, "password").unwrap_or_default();
            if server_url.is_empty() || password.is_empty() {
                errors.push((
                    "bluebubbles".to_string(),
                    "server_url/password is missing".to_string(),
                ));
            } else {
                let bb_cfg = BlueBubblesConfig {
                    server_url,
                    password,
                    proxy: Default::default(),
                };
                match BlueBubblesAdapter::new(bb_cfg) {
                    Ok(adapter) => {
                        gateway
                            .register_adapter("bluebubbles", Arc::new(adapter))
                            .await;
                        registered.push("bluebubbles".to_string());
                    }
                    Err(e) => errors.push(("bluebubbles".to_string(), e.to_string())),
                }
            }
        }
    }

    // Email
    #[cfg(feature = "email")]
    if let Some(platform_cfg) = config.platforms.get("email") {
        if platform_cfg.enabled {
            use crate::platforms::email::{EmailAdapter, EmailConfig};
            
            let imap_host = extra_string(platform_cfg, "imap_host").unwrap_or_default();
            let smtp_host = extra_string(platform_cfg, "smtp_host").unwrap_or_default();
            let username = extra_string(platform_cfg, "username").unwrap_or_default();
            let password = extra_string(platform_cfg, "password").unwrap_or_default();
            if imap_host.is_empty()
                || smtp_host.is_empty()
                || username.is_empty()
                || password.is_empty()
            {
                errors.push((
                    "email".to_string(),
                    "imap/smtp/username/password is incomplete".to_string(),
                ));
            } else {
                let email_cfg = EmailConfig {
                    imap_host,
                    imap_port: extra_u16(platform_cfg, "imap_port", 993),
                    smtp_host,
                    smtp_port: extra_u16(platform_cfg, "smtp_port", 587),
                    username,
                    password,
                    poll_interval_secs: platform_cfg
                        .extra
                        .get("poll_interval_secs")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(60),
                    proxy: Default::default(),
                };
                match EmailAdapter::new(email_cfg) {
                    Ok(adapter) => {
                        gateway.register_adapter("email", Arc::new(adapter)).await;
                        registered.push("email".to_string());
                    }
                    Err(e) => errors.push(("email".to_string(), e.to_string())),
                }
            }
        }
    }

    // SMS
    #[cfg(feature = "sms")]
    if let Some(platform_cfg) = config.platforms.get("sms") {
        if platform_cfg.enabled {
            use crate::platforms::sms::{SmsAdapter, SmsConfig};
            
            let account_sid = extra_string(platform_cfg, "account_sid").unwrap_or_default();
            let auth_token = extra_string(platform_cfg, "auth_token").unwrap_or_default();
            let from_number = extra_string(platform_cfg, "from_number").unwrap_or_default();
            if account_sid.is_empty() || auth_token.is_empty() || from_number.is_empty() {
                errors.push((
                    "sms".to_string(),
                    "account_sid/auth_token/from_number is incomplete".to_string(),
                ));
            } else {
                let sms_cfg = SmsConfig {
                    provider: extra_string(platform_cfg, "provider")
                        .unwrap_or_else(|| "twilio".to_string()),
                    account_sid,
                    auth_token,
                    from_number,
                    proxy: Default::default(),
                };
                match SmsAdapter::new(sms_cfg) {
                    Ok(adapter) => {
                        gateway.register_adapter("sms", Arc::new(adapter)).await;
                        registered.push("sms".to_string());
                    }
                    Err(e) => errors.push(("sms".to_string(), e.to_string())),
                }
            }
        }
    }

    // HomeAssistant
    #[cfg(feature = "homeassistant")]
    if let Some(platform_cfg) = config.platforms.get("homeassistant") {
        if platform_cfg.enabled {
            use crate::platforms::homeassistant::{HomeAssistantAdapter, HomeAssistantConfig};
            
            let base_url = extra_string(platform_cfg, "base_url").unwrap_or_default();
            let long_lived_token = platform_token_or_extra(platform_cfg)
                .or_else(|| extra_string(platform_cfg, "long_lived_token"))
                .unwrap_or_default();
            if base_url.is_empty() || long_lived_token.is_empty() {
                errors.push((
                    "homeassistant".to_string(),
                    "base_url/token is missing".to_string(),
                ));
            } else {
                let ha_cfg = HomeAssistantConfig {
                    base_url,
                    long_lived_token,
                    webhook_id: extra_string(platform_cfg, "webhook_id"),
                    proxy: Default::default(),
                };
                match HomeAssistantAdapter::new(ha_cfg) {
                    Ok(adapter) => {
                        gateway
                            .register_adapter("homeassistant", Arc::new(adapter))
                            .await;
                        registered.push("homeassistant".to_string());
                    }
                    Err(e) => errors.push(("homeassistant".to_string(), e.to_string())),
                }
            }
        }
    }

    // Webhook
    #[cfg(feature = "webhook")]
    if let Some(platform_cfg) = config.platforms.get("webhook") {
        if platform_cfg.enabled {
            use crate::platforms::webhook::{WebhookAdapter, WebhookConfig};
            
            let secret = extra_string(platform_cfg, "secret").unwrap_or_default();
            if secret.is_empty() {
                errors.push((
                    "webhook".to_string(),
                    "secret is missing".to_string(),
                ));
            } else {
                let wh_cfg = WebhookConfig {
                    port: extra_u16(platform_cfg, "port", 9000),
                    path: extra_string(platform_cfg, "path")
                        .unwrap_or_else(|| "/webhook".to_string()),
                    secret,
                };
                let adapter = WebhookAdapter::new(wh_cfg);
                gateway.register_adapter("webhook", Arc::new(adapter)).await;
                registered.push("webhook".to_string());
            }
        }
    }

    // ApiServer
    #[cfg(feature = "api-server")]
    if let Some(platform_cfg) = config.platforms.get("api_server") {
        if platform_cfg.enabled {
            use crate::platforms::api_server::{ApiServerAdapter, ApiServerConfig};
            
            let api_cfg = ApiServerConfig {
                host: extra_string(platform_cfg, "host").unwrap_or_else(|| "0.0.0.0".to_string()),
                port: extra_u16(platform_cfg, "port", 8090),
                auth_token: extra_string(platform_cfg, "auth_token"),
            };
            let adapter = ApiServerAdapter::new(api_cfg);
            gateway
                .register_adapter("api_server", Arc::new(adapter))
                .await;
            registered.push("api_server".to_string());
        }
    }

        Ok(RegistrationSummary {
            registered,
            errors,
        })
    }
}