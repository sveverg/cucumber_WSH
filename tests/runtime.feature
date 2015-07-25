Scenario: undefined step
	When undefined step
	And step
	Then print
		"Undefined When step is expected to interrupt scenario"