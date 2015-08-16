# Tests for proper calling and omitting Finally block
Scenario: print something
	When print
		"something"
 
# 1
# Reaction on different failed steps in scenario
 
Scenario: failed Given aborts Scenario without calling Finally
	Given failed step
	When print
		"Failed Given is expected to interrupt scenario, this step will never be called"
Finally: should be omitted
	When print
		"Failed Given is expected to abort scenario and omit Finally block"
 
Scenario: failed When finishes Scenario and calls Finally
	When failed step
	And print
		"Failed When is expected to finish scenario, this step will never be called"
Finally:
	When print
		"Finally step should be called"
 
Scenario: failed Then does not stop Scenario execution
	When step
	Then failed step
 
	When print
		"Next step should be called"
Finally:
	When print
		"Finally step should be called too"
 
Scenario: syntax error after Given prevents execution
	Given step
	" And syntax error
	# "
	When print
		"Next step should be omitted"
Finally: 
	When print
		"Finally step should be omitted"
 
Scenario: syntax error after When prevents execution
	Given step
	# also check, that failed step will be remembered
	Then failed step
	When step
	" And syntax error
	# "
	And print
		"Next step should be omitted"
Finally: 
	When print
		"Finally step should be omitted"
 
Scenario: syntax error after Then prevents execution
	Given step
	Then step
	"And syntax error
	# "
	When print
		"Next step should be omitted"
Finally:
	When print
		"Finally should be omitted"
 
# 2
# Proper conclusion of block Finally
 
Scenario: Finally block is aborted by next Scenario
	#It used to stretch through Scenario declaration
	Then failed step
	#If we are still in Finally, failed Then causes fatal error and aborts execution
	When print
		"Step should be called"
 
# 3
# Finally execution together with outlines and procedures
 
Scenario Outline: Finally error stops outline cycle
	When step
	And print
		"Cycle passed"
Finally:
	When print
		"Finally passed"
	Then failed step
Examples: conventional table
	| number | word   |
	| 1      | one    |
	| 11     | eleven |
 
GivenProcedure: procedure step
	When step
	Then failed step
 
# Scenario: failed Then statement in When-called procedure finishes Scenario and calls Finally
 
Feature: counted fails
	Background:
		When set fail number to 1
 
	Scenario Outline: Given error prevents Finally execution, but not whole cycle
		Given counted fail
		When print
			"Cycle passed"
	Finally:
		When print
			"Finally passed"
	Examples:
	| arg1 | arg2 |
	| 5    |    7 |
	| 3    |    8 |