import * as core from "@actions/core"
import * as github from "@actions/github"
import * as artifact from "@actions/artifact"
import * as FileSystem from "fs"
import * as os from "os"
import { spawn } from "child_process";

import { GetParam } from './Params.js'

const CliExeDirectory = "./CliExe";


function CreatePromise()
{
	let Prom = {};
	function RunPromise(Resolve,Reject)
	{
		Prom.Resolve = Resolve;
		Prom.Reject = Reject;
	}
	Prom.Promise = new Promise(RunPromise);
	let OutProm = Prom.Promise;
	OutProm.Resolve = Prom.Resolve;
	OutProm.Reject = Prom.Reject;
	return OutProm;
}


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


//	returns
//	{ .ExitCode=0, .StdOut=[], .StdErr=[] }
//	or throws on error
async function RunCommandLine(Exe,Arguments,ThrowOnNonZeroExitCode=true)
{
	if ( !Arguments )
		Arguments = [];
	//	expecting an array of args, but allow a simple string
	if ( typeof Arguments == typeof '' )
		Arguments = [Arguments];
	
	const Process = spawn( Exe, Arguments );
	
	//	promise throws or returns exit code
	const ProcessPromise = CreatePromise();
	//	capture everything
	const StdOut = [];
	const StdErr = [];

	function OnStdOut(Data)
	{
		//	convert node's Buffer output (which ends in linefeed)
		Data = Data.toString().trimEnd();
		StdOut.push(Data);
	}
	function OnStdErr(Data)
	{
		Data = Data.toString().trimEnd();
		StdErr.push(Data);
	}
	function OnError(Error)
	{
		if ( Error.message )
			Error = Error.message;

		ProcessPromise.Reject(Error);
	}
	function OnProcessExit(ExitCode)
	{
		//console.log(`OnProcessExit(${ExitCode}) null=crash`);
		if ( ExitCode === null )
			return OnError(`Null exit code from process (crash?)`);
			
		ProcessPromise.Resolve(ExitCode);
	}
	Process.on('error',OnError);
	Process.stdout.on('data',OnStdOut);
	Process.stderr.on('data',OnStdErr);
	Process.on("close",OnProcessExit);

	const ExitCode = await ProcessPromise;
	if ( ExitCode != 0 )
	{
		if ( ThrowOnNonZeroExitCode )
			throw `Process exit code ${ExitCode}; stdout=${StdOut} stderr=${StdErr}`;
		console.warn(`Process exit code ${ExitCode}; stdout=${StdOut} stderr=${StdErr}`);
	}
	
	function GetNiceOutput(OutputData)
	{
		if ( OutputData.length == 0 )
			return null;
		if ( OutputData.length == 1 )
			return OutputData[0];
		return OutputData;
	}
	
	const Output = {};
	Output.ExitCode = ExitCode;
	Output.StdOut = GetNiceOutput(StdOut);
	Output.StdErr = GetNiceOutput(StdErr);
	
	//	put stdout together and return it
	//console.log(`Process output; ${JSON.stringify(Output)}`);
	return Output;
}

async function RunCommandLineJson(Exe,Command,ThrowOnNonZeroExitCode=true)
{
	const Output = await RunCommandLine(...arguments);
	try
	{
		Output.StdOut = JSON.parse(Output.StdOut);
		Output.StdErr = JSON.parse(Output.StdErr);
		
		if ( Array.isArray(Output.StdOut) && Output.StdOut.length == 1 )
			Output.StdOut = Output.StdOut[0];
		
		if ( Array.isArray(Output.StdErr) && Output.StdErr.length == 1 )
			Output.StdErr = Output.StdErr[0];

		//	output often "null" (which turns into null)
		if ( Output.StdOut )
			return Output.StdOut;
		return Output.StdErr;
	}
	catch(e)
	{
		throw `Failed to parse JSON (${e}) from command output; ${Output}`;
	}
}


class UgsClient
{
	constructor(ExePath)
	{
		if ( !FileSystem.existsSync(ExePath) )
			throw `Exe file not found at; ${ExePath}`;
		this.Exe = ExePath;
	}
	
	async GetVersion()
	{
		const VersionOutput = await RunCommandLine( this.Exe,`--version`);
		const Version = VersionOutput.StdOut;
		return Version;
	}
	
	async SetCredentials(Key,Secret)
	{
		//	when piping, need to use the shell
		//	https://stackoverflow.com/a/39482554
		const Command = `echo "${Secret}" | ${this.Exe} login --json --service-key-id ${Key} --secret-key-stdin`;
		const Output = await RunCommandLineJson(`sh`,[`-c`,Command]);
		
		if ( !Output )
			throw `No output from SetCredentials()`;
		
		if ( Output.Error )
			throw `SetCredentials error; ${Output.Error}`;

		if ( Output.Message )
			console.log(`SetCredentials: ${Output.Message}`);
		else
			console.log(`SetCredentials: ${JSON.stringify(Output)}`);
		//	this sets SetCredentials but doesnt verify.
		//	here we could do some basic command and see if auth is okay
	}
	
	//	return a map of names->id
	async GetBuildIds(Project,Environment)
	{
		const Command = `gsh build list --json`;
		const Output = await RunCommandLineJson( this.Exe, Command );
		
		const BuildMap = {};
		BuildMap["Fake"] = 9999;
		return BuildMap;
	}
/*
	const OutputMeta
		  "${{ secrets.UnityGameServerSecret }}" | ${{ env.exe }} login --service-key-id ${{ secrets.UnityGameServerKeyId }} --secret-key-stdin
		  echo "Listing Existing builds..."
		  ${{ env.exe }} gsh build list --json
		  echo "Creating build if not existing..."
		  ${{ env.exe }} gsh build create --name ${{ env.name }} --os-family ${{ env.osfamily }} --type ${{ env.type }} --environment-name ${{ env.environment }} --project-id ${{ env.project }}
		  BUILD ID
		  ${{ env.exe }} gsh build create-version BUILD ID --directory ${{ env.artifactpath }} --environment-name ${{ env.environment }} --project-id ${{ env.project }}
*/
	
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
	console.log(Builds);
	
	throw `todo: Do UnityServices stuff!`;
}

//  if this throws, set a github action error
run().catch( e => core.setFailed(`${e}`) );