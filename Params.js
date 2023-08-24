function GetParams()
{
	const Params = {};
	
	function ParseCommandLineArg(Argument)
	{
		const Parts = Argument.split('=');
		let Key = Parts.shift();
		
		//	trim - or --
		while ( Key.startsWith('-') )
			Key = Key.slice(1);
		
		//	ignore empty param
		if ( Key.length == 0 )
		{
			console.warn(`Got empty line param [${Key}]`);
			return;
		}
		
		//	make all params lowercase
		Key = Key.toLowerCase();
		
		//	keep anything with = in the value
		let Value = Parts.join('=');
		//	default non-value'd arguments to true to indicate presence
		if ( Value.length == 0 )
			Value = true;
		
		//console.log(`Got command line param [${Key}]=[${Value}]`);
		Params[Key] = Value;
	}
	
	process.argv.forEach(ParseCommandLineArg);
	return Params;
}

const Params = GetParams();


export function GetParam(Key)
{
	Key = Key.toLowerCase();
	if ( !Params.hasOwnProperty(Key) )
		throw `Missing required parameter "${Key}"`;
	
	return Params[Key];
}

export default Params;
