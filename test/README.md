# app-webweaver test/example

## Usage

### Main web server

Start the web server:

```shell
export DEBUG=devebot*,app*
export LOGOLITE_DEBUGLOG_ENABLED=true
node test/app/example
```

Make a request:

```curl
curl http://0.0.0.0:7979/example/1234567890
```

### Multiple servers

```shell
export DEBUG=devebot*,app*
export LOGOLITE_DEBUGLOG_ENABLED=true
export DEVEBOT_SANDBOX=portlets
node test/app/example
```

Make requests:

```curl
curl http://0.0.0.0:17979/example/1234567890
```
