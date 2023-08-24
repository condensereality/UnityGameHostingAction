import * as core from "@actions/core"
import * as github from "@actions/github"
import * as artifact from "@actions/artifact"
import * as os from "os"
import * as FileSystem from "fs"

import { GetParam } from './Params.js'
import { UgsClient } from './UnityGameServiceClient.js'




const CliExeDirectory = "./CliExe";

function GetCliExeFilenameForPlatform()
{
	const Platform = os.platform();
	switch ( Platform )
	{
		case 'darwin': return `ugs-macos-x64`;
	}
	throw `Unhandled platform ${Platform} in GetCliExeFilenameForPlatform()`;
}

//	returns path to exe
async function GetCliExe()
{
	//	work out which tool to fetch
	const ExeFilename = GetCliExeFilenameForPlatform();
	
	const ExePath = `${CliExeDirectory}/${ExeFilename}`;
	if ( FileSystem.existsSync(ExePath) )
		return ExePath;
	
	throw `todo: fetch gsh exe, unzip and return`;
}





async function run() 
{
	//	grab required params
	const Project = GetParam('Project');
	const Environment = GetParam('Environment');
	const Key = GetParam('Key');
	const Secret = GetParam('Secret');

	const Exe = await GetCliExe();
	const Client = new UgsClient(Exe);

	const Version = await Client.GetVersion();
	console.log(`Ugs exe version ${Version}`);

	console.log(`Setting credentials...`);
	await Client.SetCredentials( Key, Secret );

	console.log(`Fetching builds...`);
	const Builds = await Client.GetBuildIds( Project, Environment );
	console.log(`Found builds; `,Builds);

	//	grab this later so user can see what builds exist before passing param
	const BuildName = GetParam('BuildName');
	
	//	if no existing build, create one
	if ( !Builds.hasOwnProperty(BuildName) )
	{
		const BuildOsFamily = GetParam('BuildOsFamily')
		await Client.CreateBuild( BuildName, BuildOsFamily, Project, Environment );
	}
	
	const BuildId = await Client.GetBuildId( BuildName, Project, Environment );
	
	const BuildFilesDirectory = GetParam('BuildFilesDirectory');
	await Client.UploadNewBuildVersion( BuildId, BuildFilesDirectory, Project, Environment );
	
	//	need to output success or anything?
}

//  if this throws, set a github action error
run().catch( e => core.setFailed(`${e}`) );
