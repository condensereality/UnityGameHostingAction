UnityGameHostingAction
================
A small github action to publish builds to the UnityGameHosting services, 
using unity's GSH-CLI tool
- https://github.com/Unity-Technologies/unity-gaming-services-cli 


Authorisation
-------------
The UnityServicesApi uses `Service Accounts` for auth, so you need to create a service account in your unity services Dashboard
- Make sure the service key has these roles
	- https://services.docs.unity.com/multiplay-config/v1/index.html#tag/Builds/operation/ListBuilds
	- `Game Server Hosting API Editor`
	- `Game Server Hosting API Manager`
	- `Game Server Hosting API Viewer`


Development
---------------
https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action
- Remember we need to commit `node_modules`

Parameters
------------------
These can be passed via cli when testing with `--paramname=XXX`.
They are all converted to lowercase, so case insensitive.
- `BuildName=name` Name of your build. eg. `github.ref`. The action will sanitise the name (restricted to [A-Za-z0-9 -])
- `BuildFilesDirectory=/files` Path to the file-contents of your build (probably from artifact files)
- `Project=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX` your UnityServices project id
- `Environment=name` 
- `Key` Your UnityServices ServiceAccount KeyID
- `Secret` The secret to go with the key.
- `BuildOsFamily=LINUX` Os of the server (currently `WINDOWS` or `LINUX`)

Local Testing
-----------------
- `node install`
- `node ./UnityGameHostingBuildUpload.js`
- `node ./UnityGameHostingBuildUpload.js --buildname=MyTestBuild --buildfilesdirectory=/yourfiles --project=aaaa-bbbb-ccc-dddd --environment=env_eg_production --key=xxx --secret=fedcba9876543210`

