# Tests for proper calling and omitting Finally block
Scenario: print something
	When print
		"something"
 
Scenario: check, that failed Given aborts Scenario without calling Finally
	Given failed step
	When print
		"Failed Given is expected to interrupt scenario, this step will never be called"
Finally: should be omitted
	When print
		"Failed Given is expected to abort scenario and omit Finally block"
 
Scenario: check, that failed When finishes Scenario and calls Finally
	When failed step
	And print
		"Failed When is expected to finish scenario, this step will never be called"
Finally:
	When print
		"Finally step should be called"
 
Scenario: check, that failed Then does not stop Scenario execution
	When step
	Then failed step
 
	When print
		"Next step should be called"
Finally:
	When print
		"Finally step should be called too"
 
Scenario: check, that syntax error after Given aborts Scenario without calling Finally
	Given step
	" And syntax error
	# "
	When print
		"Syntax error is expected to interrupt scenario, this step will never be called"
Finally: should be omitted
	When print
		"Syntax error is expected to abort scenario and omit Finally block"
 
Scenario: check, that syntax error after When finishes Scenario and calls Finally
	Given step
	# also check, that failed step will be remembered
	Then failed step
	When step
	" And syntax error
	# "
	And print
		"Syntax error is expected to finish scenario, this step will never be called"
Finally: 
	When print
		"Finally step should be called"
 
Scenario: check, that syntax error after Then does not finish anything
	Given step
	Then step
	"And syntax error
	# "
	When print
		"Next step should be omitted"
Finally:
	When print
		"Finally should be called"
 
# TEMPORARY it fails
Scenario: Finally block is aborted by next Scenario
	#It used to stretch through Scenario declaration
	Then failed step
	#If we are still in Finally, failed Then causes fatal error and aborts execution
	When print
		"Step should be omitted"

