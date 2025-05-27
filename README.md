node-red-ironflock
===================

A <a href="http://nodered.org" target="_new">Node-RED</a> node to integrate the node-RED app into the IronFlock IoT Platform.
Forked from <a href="https://www.npmjs.com/package/node-red-contrib-wamp" target="_new">node-red-contrib-wamp</a>.

This plugin is preinstalled in the [Node-RED app](https://studio.ironflock.com/en/apps/Node-RED_Runner) in the IronFlock IoT App Store and **only works in this context**.

Development
-----------

Run the following command in your Node-RED user directory - typically `~/.node-red`

    npm install @record-evolution/node-red-ironflock


Usage
-----

The nodes allow you to interact with data sent by other apps on your device fleet. You can subscribe to a "table" to receive all data that is inserted into the apps table.
You can also publish transformed data to a table of an app on your fleet.
Finally apps can register procedures under a topic. You can call these procedures with the IronFlock call-node from the node-RED app.
