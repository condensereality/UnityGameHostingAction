import * as core from "@actions/core"
import * as github from "@actions/github"
import * as artifact from "@actions/artifact"
import * as os from "os"
import * as FileSystem from "fs"
import * as Path from "path"
import * as Process from "process"
import * as Url from "url"

//	no __dirname or __filename in module-js node
const __dirname = Url.fileURLToPath(new URL('.', import.meta.url));

import { GetParam } from './Params.js'
import { UgsClient } from './UnityGameServiceClient.js'


//	gr: this is expecting working dir to be same place as the action
//		which could easily be different, and maybe different from
//		BuildFilesDirectory
//	gr: now auto-prefixing with __dirname if path is not absolute
const CliExeDirectory = "./CliExe";


function GetCliExeFilenameForPlatform()
{
	const Platform = os.platform();
	switch ( Platform )
	{
		case 'darwin': return `ugs-macos-x64`;
		case 'linux': return `ugs-linux-x64`;
	}
	throw `Unhandled platform ${Platform} in GetCliExeFilenameForPlatform()`;
}

//	returns path to exe
async function GetCliExe()
{
	//	work out which tool to fetch
	const ExeFilename = GetCliExeFilenameForPlatform();
	let ExePath = `${CliExeDirectory}/${ExeFilename}`;
	
	//	expect exe relative to our script
	if ( !Path.isAbsolute(ExePath) )
	{
		ExePath = __dirname + ExePath;
	}

	//	cant find file
	if ( !FileSystem.existsSync(ExePath) )
	{
		const CurrentWorkingDir = Process.cwd();
		throw `CLI exe ${ExePath} doesnt exist (cwd=${CurrentWorkingDir} __dirname=${__dirname}), todo: fetch gsh exe, unzip and return`;
	}
	
	//	make exe executable
	try
	{
		//	X_OK just sets x on user
		FileSystem.chmodSync( ExePath, FileSystem.constants.S_IXUSR | FileSystem.constants.S_IRUSR );
		//FileSystem.chmodSync( ExePath, 0o777 );
	}
	catch(e)
	{
		throw `Failed to set ${ExePath} as executable; ${e}`;
	}
	
	return ExePath;
}

function SanitiseBuildName(BuildName)
{
	//	special "make PR name nice"
	//	`refs/pull/123/merge`.replace( new RegExp(`refs\/pull\/([0-9]*)\/`), `PullRequest-$1-`)
	//	becomes 'PullRequest-123-merge'
	BuildName = BuildName.replace( new RegExp(`refs\/pull\/([0-9]*)\/`), `PullRequest-$1-`);

	//	build name might be a pull request or github ref
	//	so tidy that up
	//	refs/heads/graham/8079-UnityGameHostingAutoBuild
	const StripPrefixes =
	[
		`refs/heads/`
	];
	function StripBuildNamePrefix(Prefix)
	{
		if ( BuildName.startsWith(Prefix) )
			BuildName = BuildName.substr(Prefix.length)
	}
	StripPrefixes.forEach( StripBuildNamePrefix );
	
	//	then replace any illegal characters with -
	//	gr: space is actually allowed too
	const BadCharPattern = /[^A-Za-z0-9-]/g;
	BuildName = BuildName.replace( BadCharPattern, '-' );
	return BuildName;
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

	//	check build input before messing with builds
	//	gr: whilst we need to mess with paths for cliexe (see CliExeDirectory)
	//		require the user to pass a full path to build files (ie. prefixed with GITHUB_WORKSPACE/)
	//const RequireAbsoluteBuildFilesDir = true;
	//	gr: exe now finds it's own proper full path, so this can be in working directory again
	const RequireAbsoluteBuildFilesDir = false;
	
	const BuildFilesDirectory = GetParam('BuildFilesDirectory');
	if ( RequireAbsoluteBuildFilesDir )
	{
		if ( !Path.isAbsolute(BuildFilesDirectory) )
		{
			throw `BuildFilesDirectory param (=${BuildFilesDirectory}) is [currently] expecting an absolute path; prefix with $GITHUB_WORKSPACE?`;
		}
	}
	
	//	grab this later so user can see what builds exist before passing param
	const InputBuildName = GetParam('BuildName');
	
	const BuildName = SanitiseBuildName(InputBuildName);
	if ( BuildName != InputBuildName )
		console.warn(`Santised input build name (${InputBuildName}) to ${BuildName}`);
	
	//	if no existing build, create one
	if ( !Builds.hasOwnProperty(BuildName) )
	{
		const BuildOsFamily = GetParam('BuildOsFamily')
		await Client.CreateBuild( BuildName, BuildOsFamily, Project, Environment );
	}
	
	const BuildId = await Client.GetBuildId( BuildName, Project, Environment );

	await Client.UploadNewBuildVersion( BuildId, BuildFilesDirectory, Project, Environment );

	//	need to output success or anything?
	//	maybe would be nice to get the CLI tools output displayed
}

//  if this throws, set a github action error
run().catch( e => core.setFailed(`${e}`) );
