import * as FileSystem from "fs"
import { spawn } from "child_process";



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



//	returns
//	{ .ExitCode=0, .StdOut=[], .StdErr=[] }
//	or throws on error
async function RunCommandLine(Exe,Arguments,ThrowOnNonZeroExitCode=true)
{
	if ( !Arguments )
		Arguments = [];
	//	expecting an array of args, but allow a simple string
	if ( typeof Arguments == typeof '' )
		Arguments = Arguments.split(' ');
	
	console.log(`Running process [${Exe}], args=${Arguments}...`);
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
	
	//	turn arrays into something slightly easier to use (a string or null)
	function GetNiceOutput(OutputData)
	{
		if ( OutputData.length == 0 )
			return null;
		if ( OutputData.length == 1 )
			return OutputData[0];
		return OutputData.join(``);
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
		//	hacky fix for
		//	https://github.com/Unity-Technologies/unity-gaming-services-cli/issues/2
		if ( typeof Output.StdOut == typeof '' )
			Output.StdOut = Output.StdOut.replaceAll(',,', ',');
		
		if ( typeof Output.StdErr == typeof '' )
			Output.StdErr = Output.StdErr.replaceAll(',,', ',');

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
		console.error(`Json parse error stdout: ${Output.StdOut}`);
		console.error(`Json parse error stderr: ${Output.StdErr}`);
		throw `Failed to parse JSON (${e}) from command output; ${Output.StdOut}`;
	}
}


export class UgsClient
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
		const Command = `gsh build list --json --environment-name ${Environment} --project-id ${Project}`;
		const Output = await RunCommandLineJson( this.Exe, Command );
		
		let BuildMetas = Output;
		//	output when there's one build, is just json
		//	multiple builds gives an array
		if ( !Array.isArray(BuildMetas) )
			BuildMetas = [BuildMetas];
		console.log(`builds;`,JSON.stringify(Output));
		
		const BuildMap = {};
		function WriteBuildToMap(BuildMeta)
		{
			const Name = BuildMeta.BuildName;
			const BuildId = BuildMeta.BuildId;
			BuildMap[Name] = BuildId;
		}
		BuildMetas.forEach( WriteBuildToMap );

		return BuildMap;
	}
	
	async CreateBuild(BuildName,BuildOsFamily,Project,Environment)
	{
		if ( BuildName == "" )
			throw `CreateBuild(${BuildName},${BuildOsFamily},${Project},${Environment}) missing build name`;
		if ( BuildOsFamily == "" )
			throw `CreateBuild(${BuildName},${BuildOsFamily},${Project},${Environment}) missing build os family (Expecting LINUX)`;
		
		const BuildType = `FILEUPLOAD`;
		
		//${{ env.exe }} gsh build create --name ${{ env.name }} --os-family ${{ env.osfamily }} --type ${{ env.type }} --environment-name ${{ env.environment }} --project-id ${{ env.project }}
		const Command = `gsh build create --json --name ${BuildName} --os-family ${BuildOsFamily} --type ${BuildType} --environment-name ${Environment} --project-id ${Project}`;
		const Output = await RunCommandLineJson( this.Exe, Command );
		
		let BuildMetas = Output;
		//	output when there's one build, is just json
		//	multiple builds gives an array
		if ( !Array.isArray(BuildMetas) )
			BuildMetas = [BuildMetas];
		console.log(`builds;`,JSON.stringify(Output));
		
		const BuildMap = {};
		function WriteBuildToMap(BuildMeta)
		{
			const Name = BuildMeta.BuildName;
			const BuildId = BuildMeta.BuildId;
			BuildMap[Name] = BuildId;
		}
		BuildMetas.forEach( WriteBuildToMap );

		return BuildMap;
	}
	
	
	async GetBuildId(BuildName,Project,Environment)
	{
		const Builds = await this.GetBuildIds(Project,Environment);
		
		if ( !Builds.hasOwnProperty(BuildName) )
			throw `No build name matching ${BuildName}; Possible build names; ${Object.keys(Builds)}`;
		
		return Builds[BuildName];
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

export default UgsClient;
