use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use tower::ServiceExt;

#[tokio::test]
async fn health_ok() {
    let _ = tracing_subscriber::fmt::try_init();
    let cfg = hermes_config::GatewayConfig::default();
    let state = hermes_dashboard::HttpServerState::build(cfg).await.unwrap();
    let app = hermes_dashboard::router(state);
    let res = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
}

#[tokio::test]
async fn metrics_prometheus_has_counters() {
    let _ = tracing_subscriber::fmt::try_init();
    let cfg = hermes_config::GatewayConfig::default();
    let state = hermes_dashboard::HttpServerState::build(cfg).await.unwrap();
    let app = hermes_dashboard::router(state);
    let res = app
        .oneshot(
            Request::builder()
                .uri("/metrics")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = res.into_body().collect().await.unwrap().to_bytes();
    let s = String::from_utf8(body.to_vec()).unwrap();
    assert!(s.contains("hermes_llm_requests_total"));
}

#[tokio::test]
#[ignore = "requires live provider credentials to pass reliably"]
async fn command_help_runs_through_gateway() {
    let _ = tracing_subscriber::fmt::try_init();
    let cfg = hermes_config::GatewayConfig::default();
    let state = hermes_dashboard::HttpServerState::build(cfg).await.unwrap();
    let app = hermes_dashboard::router(state);
    let payload = serde_json::json!({ "command": "/help" });
    let res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/commands")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    
    // The command endpoint should accept the request
    // Note: Without a real LLM provider configured, it might fail with 500
    // But the endpoint itself should at least accept the request
    assert_eq!(res.status(), StatusCode::OK);
    
    let body = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
    
    // The response should have the expected structure
    assert!(v.get("accepted").is_some());
    assert!(v.get("output").is_some());
}
