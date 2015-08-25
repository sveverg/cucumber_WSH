// JSON is not natively supported by WSH and doesn't allow comments
// this file also supports wildcard * and ? symbols
{
	// this endings appended to the name of feature file
	baseline: "_baseline.txt",
	definitions: [".js","_defs.js"],
	report: "_report.txt",
	// path to features
	features: ["features\\*\\*.feature"],
	// loaded scripts, listed in order of loading
	scripts: ["globalDefs\\steps.js","features\\support\\env.js"],

	//special settings
	// breaks DocString, if scenario, procedure or feature declaration was met
	interrupt_doc_string_on_block_annotation: true
}