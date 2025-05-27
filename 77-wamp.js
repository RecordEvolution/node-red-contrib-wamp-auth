module.exports = function (RED) {
  "use strict";
  const events = require("events");
  const autobahn = require("autobahn");

  let SWARM_KEY, APP_KEY, ENV, CB_REALM, DATAPODS_WS_URI, STUDIO_WS_URI_OLD, STUDIO_WS_URI, LOCALHOST_WS_URI, socketURIMap;

  try {
    SWARM_KEY = process.env["SWARM_KEY"];
    if (!SWARM_KEY) {
      throw new Error("Environment variable SWARM_KEY not set!");
    }
  } catch (e) {
    console.error(e);
    throw e;
  }

  try {
    APP_KEY = process.env["APP_KEY"];
    if (!APP_KEY) {
      throw new Error("Environment variable APP_KEY not set!");
    }
  } catch (e) {
    console.error(e);
    throw e;
  }

  try {
    ENV = process.env["ENV"]?.toLowerCase();
    if (!ENV) {
      throw new Error("Environment variable ENV not set!");
    }
  } catch (e) {
    console.error(e);
    throw e;
  }

  CB_REALM = `realm-${SWARM_KEY}-${APP_KEY}-${ENV}`;

  DATAPODS_WS_URI = "wss://cbw.datapods.io/ws-ua-usr";
  STUDIO_WS_URI_OLD = "wss://cbw.record-evolution.com/ws-ua-usr";
  STUDIO_WS_URI = "wss://cbw.ironflock.com/ws-ua-usr";
  LOCALHOST_WS_URI = "ws://localhost:8080/ws-ua-usr";

  socketURIMap = {
    "https://studio.datapods.io": DATAPODS_WS_URI,
    "https://studio.record-evolution.com": STUDIO_WS_URI_OLD,
    "https://studio.ironflock.com": STUDIO_WS_URI,
    "http://localhost:8085": LOCALHOST_WS_URI,
  };


  function getWebSocketURI() {
    const reswarm_url = process.env.RESWARM_URL;
    if (!reswarm_url) {
      return STUDIO_WS_URI;
    }
    return socketURIMap[reswarm_url];
  }

  function WampClientNode(config) {
    RED.nodes.createNode(this, config);

    this.address = getWebSocketURI()

    this.realm = `realm-${SWARM_KEY}-${config.appKey ?? APP_KEY}-${ENV}`;

    // get Device Serialnumber von environment
    const deviceSerialNumber = process.env.DEVICE_SERIAL_NUMBER;
    if (!deviceSerialNumber) {
      RED.log.error("Environment Variable DEVICE_SERIAL_NUMBER not found!");
    } else {
      RED.log.info("Using DEVICE_SERIAL_NUMBER from environment");
    }

    this.authId = deviceSerialNumber;
    this.password = deviceSerialNumber;

    this.wampClient = function () {
      return wampClientPool.get(
        this.address,
        this.realm,
        this.authId,
        this.password
      );
    };

    this.on = function (a, b) {
      this.wampClient().on(a, b);
    };
    this.close = function (done) {
      wampClientPool.close(this.address, this.realm, done);
    };
  }

  RED.nodes.registerType("IronFlock App", WampClientNode);

  function WampClientPublishNode(config) {
    RED.nodes.createNode(this, config);
    this.clientNode = RED.nodes.getNode(config.appRealm);
    const topic = `${SWARM_KEY}-${this.clientNode?.appKey ?? APP_KEY}-${config.table}`;

    if (this.clientNode) {
      var node = this;
      node.wampClient = this.clientNode.wampClient();

      this.clientNode.on("ready", function () {
        node.status({
          fill: "green",
          shape: "dot",
          text: "node-red:common.status.connected",
        });
      });
      this.clientNode.on("closed", function () {
        node.status({
          fill: "red",
          shape: "ring",
          text: "node-red:common.status.not-connected",
        });
      });

      node.on("input", function (msg) {
        if (msg.hasOwnProperty("payload")) {
          var payload = msg.payload;

          RED.log.info(
            "wamp client publish: topic=" +
              topic +
              ", payload=" +
              JSON.stringify(payload)
          );
          payload && node.wampClient.publish(topic, payload);
        }
      });
    } else {
      RED.log.error("wamp client config is missing!");
    }

    this.on("close", function (done) {
      if (this.clientNode) {
        this.clientNode.close(done);
      } else {
        done();
      }
    });
  }

  RED.nodes.registerType("IronFlock out", WampClientPublishNode);

  function WampClientSubscribeNode(config) {
    RED.nodes.createNode(this, config);
    this.clientNode = RED.nodes.getNode(config.appRealm);
    const topic = `${SWARM_KEY}-${this.clientNode?.appKey ?? APP_KEY}-${config.table}`;

    if (this.clientNode) {
      var node = this;
      node.wampClient = this.clientNode.wampClient();

      this.clientNode.on("ready", function () {
        node.status({
          fill: "green",
          shape: "dot",
          text: "node-red:common.status.connected",
        });
      });
      this.clientNode.on("closed", function () {
        node.status({
          fill: "red",
          shape: "ring",
          text: "node-red:common.status.not-connected",
        });
      });

      node.wampClient.subscribe(topic, function (args, kwargs) {
        var msg = {
          topic: topic,
          payload: { args: args, kwargs: kwargs },
        };
        node.send(msg);
      });

    } else {
      RED.log.error("wamp client config is missing!");
    }

    this.on("close", function (done) {
      if (this.clientNode) {
        this.clientNode.close(done);
      } else {
        done();
      }
    });
  }

  RED.nodes.registerType("IronFlock in", WampClientSubscribeNode);

  function WampClientRegisterNode(config) {
    RED.nodes.createNode(this, config);
    this.clientNode = RED.nodes.getNode(config.appRealm);
    const topic = `${SWARM_KEY}-${this.clientNode?.appKey ?? APP_KEY}-${config.table}`;

    if (this.clientNode) {
      var node = this;
      node.wampClient = this.clientNode.wampClient();

      this.clientNode.on("ready", function () {
        node.status({
          fill: "green",
          shape: "dot",
          text: "node-red:common.status.connected",
        });
      });
      this.clientNode.on("closed", function () {
        node.status({
          fill: "red",
          shape: "ring",
          text: "node-red:common.status.not-connected",
        });
      });

      node.wampClient.registerProcedure(
        topic,
        function (args, kwargs) {
          RED.log.debug("procedure: " + args + ", " + kwargs);
          var d = autobahn.when.defer(); // create a deferred
          var msg = {
            procedure: topic,
            payload: { args: args, kwargs: kwargs },
            _d: d,
          };
          node.send(msg);
          return d.promise;
        }
      );

    } else {
      RED.log.error("wamp client config is missing!");
    }

    this.on("close", function (done) {
      if (this.clientNode) {
        this.clientNode.close(done);
      } else {
        done();
      }
    });
  }

  RED.nodes.registerType("IronFlock register", WampClientRegisterNode);

  function WampClientCallNode(config) {
    RED.nodes.createNode(this, config);

    this.clientNode = RED.nodes.getNode(config.appRealm);
    const topic = config.topic;

    if (this.clientNode) {
      var node = this;
      node.wampClient = this.clientNode.wampClient();

      this.clientNode.on("ready", function () {
        node.status({
          fill: "green",
          shape: "dot",
          text: "node-red:common.status.connected",
        });
      });
      this.clientNode.on("closed", function () {
        node.status({
          fill: "red",
          shape: "ring",
          text: "node-red:common.status.not-connected",
        });
      });

      node.on("input", function (msg) {
        if (topic) {
          var d = node.wampClient.callProcedure(topic, msg.payload);
          if (d) {
            d.then(
              function (resp) {
                RED.log.debug("call result: " + JSON.stringify(resp));
                node.send({ payload: resp });
              },
              function (err) {
                RED.log.warn("call response failed: " + err.error);
              }
            );
          }
        }
      });
    } else {
      RED.log.error("wamp client config is missing!");
    }

    this.on("close", function (done) {
      if (this.clientNode) {
        this.clientNode.close(done);
      } else {
        done();
      }
    });
  }

  RED.nodes.registerType("IronFlock call", WampClientCallNode);

  var wampClientPool = (function () {
    var connections = {};
    return {
      get: function (address, realm, authid, password) {
        var uri = realm + "@" + address;
        if (!connections[uri]) {
          connections[uri] = (function () {
            var obj = {
              _emitter: new events.EventEmitter(),
              wampConnection: null,
              wampSession: null,
              _connecting: false,
              _connected: false,
              _closing: false,
              _subscribeReqMap: {},
              _subscribeMap: {},
              _procedureReqMap: {},
              _procedureMap: {},
              on: function (a, b) {
                this._emitter.on(a, b);
              },
              close: function () {
                _disconnect();
              },
              publish: function (topic, message) {
                if (this.wampSession) {
                  RED.log.debug(
                    "wamp publish: topic=" +
                      topic +
                      ", message=" +
                      JSON.stringify(message)
                  );
                  if (message instanceof Object) {
                    this.wampSession.publish(topic, null, message);
                  } else if (Array.isArray(message)) {
                    this.wampSession.publish(topic, message);
                  } else {
                    this.wampSession.publish(topic, [message]);
                  }
                } else {
                  RED.log.warn("publish failed, wamp is not connected.");
                }
              },
              subscribe: function (topic, handler) {
                RED.log.debug(
                  "add to wamp subscribe request for topic: " + topic
                );
                this._subscribeReqMap[topic] = handler;

                if (this._connected && this.wampSession) {
                  this._subscribeMap[topic] = this.wampSession.subscribe(
                    topic,
                    handler
                  );
                }
              },
              // unsubscribe: function (topic) {
              // if (this._subscribeReqMap[topic]) {
              //     delete this._subscribeReqMap[topic];
              // }
              //
              // if (this._subscribeMap[topic]) {
              //     if (this.wampSession) {
              //         this.wampSession.unsubscribe(this._subscribeMap[topic]);
              //         RED.log.info("unsubscribed wamp topic: ", topic);
              //     }
              //     delete this._subscribeMap[topic];
              // }
              // },
              registerProcedure: function (procedure, handler) {
                RED.log.debug(
                  "add to wamp request for procedure: " + procedure
                );
                this._procedureReqMap[procedure] = handler;

                if (this._connected && this.wampSession) {
                  this._procedureMap[procedure] = this.wampSession.subscribe(
                    procedure,
                    handler
                  );
                }
              },
              callProcedure: function (procedure, message) {
                if (this.wampSession) {
                  RED.log.debug(
                    "wamp call: procedure=" +
                      procedure +
                      ", message=" +
                      JSON.stringify(message)
                  );
                  var d = null;
                  if (message instanceof Object) {
                    d = this.wampSession.call(procedure, null, message);
                  } else if (Array.isArray(message)) {
                    d = this.wampSession.call(procedure, message);
                  } else {
                    d = this.wampSession.call(procedure, [message]);
                  }

                  return d;
                } else {
                  RED.log.warn("call failed, wamp is not connected.");
                }
              },
            };

            var _disconnect = function () {
              if (obj.wampConnection) {
                obj.wampConnection.close();
              }
            };

            var setupWampClient = function () {
              obj._connecting = true;
              obj._connected = false;
              obj._emitter.emit("closed");
              RED.log.info(
                `trying to connect to router ${JSON.stringify({
                  address,
                  realm,
                  authid,
                  password,
                })}`
              );
              var options = {
                url: address,
                realm: realm,
                retry_if_unreachable: true,
                max_retries: 10,
                initial_retry_delay: 3,
                authmethods: ["wampcra"],
                authid: authid,
                onchallenge: function (session, method, extra) {
                  return autobahn.auth_cra.sign(password, extra.challenge);
                },
              };

              obj.wampConnection = new autobahn.Connection(options);

              obj.wampConnection.onopen = function (session) {
                RED.log.info(
                  "wamp client [" + JSON.stringify(options) + "] connected."
                );
                obj.wampSession = session;
                obj._connected = true;
                obj._emitter.emit("ready");

                obj._subscribeMap = {};
                for (var topic in obj._subscribeReqMap) {
                  obj.wampSession
                    .subscribe(topic, obj._subscribeReqMap[topic])
                    .then(
                      function (subscription) {
                        obj._subscribeMap[topic] = subscription;
                        RED.log.debug(
                          "wamp subscribe topic [" + topic + "] success."
                        );
                      },
                      function (err) {
                        RED.log.warn(
                          "wamp subscribe topic [" + topic + "] failed: " + err
                        );
                      }
                    );
                }

                obj._procedureMap = {};
                for (var procedure in obj._procedureReqMap) {
                  obj.wampSession
                    .register(procedure, obj._procedureReqMap[procedure])
                    .then(
                      function (registration) {
                        obj._procedureMap[procedure] = registration;
                        RED.log.debug(
                          "wamp register procedure [" + procedure + "] success."
                        );
                      },
                      function (err) {
                        RED.log.warn(
                          "wamp register procedure [" +
                            procedure +
                            "] failed: " +
                            err.error
                        );
                      }
                    );
                }

                obj._connecting = false;
              };

              obj.wampConnection.onclose = function (reason, details) {
                RED.log.error("DEBUG: Connection closed reason:");
                RED.log.error(JSON.stringify(reason));
                RED.log.error("DEBUG: Connection closed details:");
                RED.log.error(JSON.stringify(details));
                obj._connecting = false;
                obj._connected = false;
                if (!obj._closing) {
                  RED.log.error("unexpected close", { uri: uri });
                  obj._emitter.emit("closed");
                }
                obj._subscribeMap = {};
                RED.log.info("wamp client closed!");
                // setTimeout(function () {
                //   RED.log.error("DEBUG: Connection reopened");
                //   RED.log.info("Now open() again");
                //   try {
                //     obj.wampConnection.open();
                //   } catch (e) {
                //     RED.log.error("Error when opening after 5000 ms");
                //     RED.log.trace(e);
                //     throw e;
                //   }
                // }, 5000);
              };

              obj.wampConnection.open();
            };

            setupWampClient();
            return obj;
          })();
        }
        return connections[uri];
      },
      close: function (address, realm, done) {
        var uri = realm + "@" + address;
        if (connections[uri]) {
          RED.log.info("ready to close wamp client [" + uri + "]");
          connections[uri]._closing = true;
          connections[uri].close();
          typeof done == "function" && done();
          delete connections[uri];
        } else {
          typeof done == "function" && done();
        }
      },
    };
  })();
};
