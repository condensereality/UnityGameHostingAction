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
	- For upload docker images, you also need the
	- `Game Server Hosting Registry Editor`


Development
---------------
https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action
- Remember we need to commit `node_modules`

Parameters
------------------
These can be passed via cli when testing with `--paramname=XXX`.
They are all converted to lowercase, so case insensitive.
- `BuildName=name` Name of your build. eg. `github.ref`. The action will sanitise the name (restricted to [A-Za-z0-9 -])
- `Project=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX` your UnityServices project id
- `Environment=name` production, staging etc
- `EnvironmentId=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX` required only for docker tag & upload, this is NOT the environment name, but a UUID, it can be found in your UnityServices project's environment page
- `Key` Your UnityServices ServiceAccount KeyID
- `Secret` The secret to go with the key.
- `BuildOsFamily=LINUX` Os of the server (currently `WINDOWS` or `LINUX`)
- Specify source of the image, either a directory of files, or a container image
	- `BuildFilesDirectory=/files` Path to the file-contents of your build (probably from artifact files)
	- `LocalBuildContainerTag=name:tag` this is the `name:tag` of your LOCAL docker's image, which gets tagged then pushed to the unity registry
- `RemoteBuildVersion=v1` "Version" name on the build. This can be any string now (not auto-incremented).  https://github.com/condensereality/UnityGameHostingAction/issues/1
	- Top Tip! use git sha!

Local Testing
-----------------
- `node install`
- `node ./UnityGameHostingBuildUpload.js`
- `node ./UnityGameHostingBuildUpload.js --BuildOsFamily=Linux --buildname=MyTestBuild --buildfilesdirectory=/yourfiles --project=aaaa-bbbb-ccc-dddd --environment=env_eg_production --key=xxx --secret=fedcba9876543210`

