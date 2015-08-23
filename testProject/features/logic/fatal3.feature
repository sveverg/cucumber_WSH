Feature: fatal error, third kind
	Scenario: failed condition in Finally stops feature execution
		When step
	Finally:
		Then failed step
	 
	Scenario: omitted because of failed step in Finally
		When print
			"Omitted because of failed step in Finally" 