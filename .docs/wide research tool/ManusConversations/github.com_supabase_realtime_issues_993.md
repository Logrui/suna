
**URL:** https://github.com/supabase/realtime/issues/993

---

Skip to content
Navigation Menu
Platform
Solutions
Resources
Open Source
Enterprise
Pricing
Sign in
Sign up
supabase
/
realtime
Public
 Sponsor
Notifications
Fork 400
 Star 7.3k
Code
Issues
46
Pull requests
12
Actions
Projects
Security
Insights
Cannot successfully connect presence on selfhosted when using a reverse proxy to handle SSL. #993
New issue
Open
Description
Destreyf
opened  · edited by Destreyf
Edits
Bug report
I confirm this is a bug with Supabase, not with my own application.
I confirm I have searched the Docs, GitHub Discussions, and Discord.
Describe the bug

I am unable to successfully run the supabase/realtime server behind an nginx-proxy nor the AWS ALB, I have other websocket applications deployed and working behind both of these environments.

If I connect to the server directly via ip:port it works just fine, however when I connect over https using the load balancer endpoint I get the following logs.

<domain>  | ** (UndefinedFunctionError) function RealtimeWeb.RealtimeChannel.handle_out/3 is undefined or private
<domain>  |     (realtime 2.28.40) RealtimeWeb.RealtimeChannel.handle_out("presence_diff", %{joins: %{"d6d2b22b-8472-4088-8e0e-4bc6793e2d94" => %{metas: [%{:phx_ref => "F9Cd_xKcHtJMugXS", "state" => "online"}]}}, leaves: %{}}, %Phoenix.Socket{assigns: %{access_token: "<redacted>", ack_broadcast: false, channel_name: "presence", claims: %{"exp" => 1716073957, "role" => "anon", "sid" => "d6d2b22b-8472-4088-8e0e-4bc6793e2d94"}, confirm_token_ref: #Reference<0.2234418692.2823290882.151704>, db_conn: #PID<0.3294.0>, headers: [{"x-forwarded-for", "<my-ip>"}, {"x-forwarded-proto", "https"}, {"x-forwarded-scheme", "https"}, {"x-real-ip", "<my-ip>"}], is_new_api: true, jwt_jwks: nil, jwt_secret: "<redacted>>", limits: %{max_bytes_per_second: 100000, max_channels_per_client: 100, max_concurrent_users: 1000, max_events_per_second: 100, max_joins_per_second: 100}, log_level: :error, pg_change_params: [], pg_sub_ref: nil, policies: nil, postgres_cdc_module: Extensions.PostgresCdcRls, postgres_extension: %{"db_host" => "<redacted>", "db_name" => "<redacted>", "db_password" => "<redacted>", "db_port" => "auevoqDKvsPBm+i/ssWgjw==", "db_user" => "7AAfEqbva4oVA0swrz+Qkg==", "poll_interval_ms" => 100, "poll_max_changes" => 100, "poll_max_record_bytes" => 1048576, "publication" => "supabase_realtime", "region" => "us-west-2", "slot_name" => "supabase_realtime_replication_slot", "ssl_enforced" => true}, presence_key: "d6d2b22b-8472-4088-8e0e-4bc6793e2d94", public?: true, rate_counter: %Realtime.RateCounter{id: {:channel, :events, "realtime"}, avg: 1.1818181818181819, bucket: [0, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 2, 2, 2, 0, 2, 0], max_bucket_len: 60, tick: 1000, tick_ref: #Reference<0.2234418692.2823290881.177652>, idle_shutdown: :infinity, idle_shutdown_ref: nil, telemetry: %{emit: true, event_name: [:realtime, :rate_counter, :channel, :events], measurements: %{limit: 100, sum: 0}, metadata: %{id: {:channel, :events, "realtime"}, tenant: "realtime"}}}, self_broadcast: false, tenant: "realtime", tenant_token: "<redacted>", tenant_topic: "realtime:presence", using_broadcast?: true}, channel: RealtimeWeb.RealtimeChannel, channel_pid: #PID<0.3454.0>, endpoint: RealtimeWeb.Endpoint, handler: RealtimeWeb.UserSocket, id: "user_socket:realtime", joined: true, join_ref: "40", private: %{log_handle_in: :info, log_join: :info}, pubsub_server: Realtime.PubSub, ref: nil, serializer: Phoenix.Socket.V1.JSONSerializer, topic: "realtime:presence", transport: :websocket, transport_pid: #PID<0.3327.0>})
<domain>  |     (phoenix 1.7.7) lib/phoenix/channel/server.ex:338: Phoenix.Channel.Server.handle_info/2
<domain>  |     (stdlib 4.3) gen_server.erl:1123: :gen_server.try_dispatch/4
<domain>  |     (stdlib 4.3) gen_server.erl:1200: :gen_server.handle_msg/6
<domain>  |     (stdlib 4.3) proc_lib.erl:240: :proc_lib.init_p_do_apply/3
<domain>  | Last message: %Phoenix.Socket.Broadcast{topic: "realtime:presence", event: "presence_diff", payload: %{joins: %{"d6d2b22b-8472-4088-8e0e-4bc6793e2d94" => %{metas: [%{:phx_ref => "F9Cd_xKcHtJMugXS", "state" => "online"}]}}, leaves: %{}}}
<domain>  | State: %Phoenix.Socket{assigns: %{access_token: "<redacted>", ack_broadcast: false, channel_name: "presence", claims: %{"exp" => 1716073957, "role" => "anon", "sid" => "d6d2b22b-8472-4088-8e0e-4bc6793e2d94"}, confirm_token_ref: #Reference<0.2234418692.2823290882.151704>, db_conn: #PID<0.3294.0>, headers: [{"x-forwarded-for", "<my-ip>"}, {"x-forwarded-proto", "https"}, {"x-forwarded-scheme", "https"}, {"x-real-ip", "<my-ip>"}], is_new_api: true, jwt_jwks: nil, jwt_secret: "<redacted>>", limits: %{max_bytes_per_second: 100000, max_channels_per_client: 100, max_concurrent_users: 1000, max_events_per_second: 100, max_joins_per_second: 100}, log_level: :error, pg_change_params: [], pg_sub_ref: nil, policies: nil, postgres_cdc_module: Extensions.PostgresCdcRls, postgres_extension: %{"db_host" => "<redacted>", "db_name" => "<redacted>", "db_password" => "<redacted>", "db_port" => "auevoqDKvsPBm+i/ssWgjw==", "db_user" => "7AAfEqbva4oVA0swrz+Qkg==", "poll_interval_ms" => 100, "poll_max_changes" => 100, "poll_max_record_bytes" => 1048576, "publication" => "supabase_realtime", "region" => "us-west-2", "slot_name" => "supabase_realtime_replication_slot", "ssl_enforced" => true}, presence_key: "d6d2b22b-8472-4088-8e0e-4bc6793e2d94", public?: true, rate_counter: %Realtime.RateCounter{id: {:channel, :events, "realtime"}, avg: 1.1818181818181819, bucket: [0, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 2, 2, 2, 0, 2, 0], max_bucket_len: 60, tick: 1000, tick_ref: #Reference<0.2234418692.2823290881.177652>, idle_shutdown: :infinity, idle_shutdown_ref: nil, telemetry: %{emit: true, event_name: [:realtime, :rate_counter, :channel, :events], measurements: %{limit: 100, sum: 0}, metadata: %{id: {:channel, :events, "realtime"}, tenant: "realtime"}}}, self_broadcast: false, tenant: "realtime", tenant_token: "<redacted>", tenant_topic: "realtime:presence", using_broadcast?: true}, channel: RealtimeWeb.RealtimeChannel, channel_pid: #PID<0.3454.0>, endpoint: RealtimeWeb.Endpoint, handler: RealtimeWeb.UserSocket, id: "user_socket:realtime", joined: true, join_ref: "40", private: %{log_handle_in: :info, log_join: :info}, pubsub_server: Realtime.PubSub, ref: nil, serializer: Phoenix.Socket.V1.JSONSerializer, topic: "realtime:presence", transport: :websocket, transport_pid: #PID<0.3327.0>}


The subscribe call emits a SUBSCRIBED then CHANNEL_ERROR state on the subscribe handler.

subscribe state SUBSCRIBED
subscribe state CHANNEL_ERROR


This is effectively the boilerplate demo found in the realtime-js repo: https://github.com/supabase/realtime-js?tab=readme-ov-file#presence

My nginx setup is using nginx-proxy-manager for testing, ideally I would use the ALB in aws, here's my config file for that

# ------------------------------------------------------------
# realtime.<domain>
# ------------------------------------------------------------

map $scheme $hsts_header {
  https   "max-age=63072000; preload";
}

server {
  set $forward_scheme http;
  set $server         "localhost";
  set $port           4000;

  listen 80;
  listen [::]:80;

  listen 443 ssl;
  listen [::]:443 ssl;

  server_name realtime.<domain>;

  location ^~ /.well-known/acme-challenge/ {
    auth_basic off;
    auth_request off;
    allow all;

    default_type "text/plain";

    root /data/letsencrypt-acme-challenge;
  }

  location = /.well-known/acme-challenge/ {
    return 404;
  }
  
  ssl_session_timeout 5m;
  ssl_session_cache shared:SSL:50m;

  # intermediate configuration. tweak to your needs.
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
  ssl_prefer_server_ciphers off;

  ssl_certificate /etc/letsencrypt/live/npm-1/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/npm-1/privkey.pem;

  # Force SSL
  set $test "";
  if ($scheme = "http") {
    set $test "H";
  }
  if ($request_uri = /.well-known/acme-challenge/test-challenge) {
    set $test "${test}T";
  }
  if ($test = H) {
    return 301 https://$host$request_uri;
  }

  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $http_connection;
  proxy_http_version 1.1;

  access_log /data/logs/proxy-host-1_access.log proxy;
  error_log /data/logs/proxy-host-1_error.log warn;

  location / {
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $http_connection;
    proxy_http_version 1.1;

    # Proxy!
    add_header       X-Served-By $host;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Scheme $scheme;
    proxy_set_header X-Forwarded-Proto  $scheme;
    proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP          $remote_addr;
    proxy_pass       $forward_scheme://$server:$port$request_uri;
  }
}
