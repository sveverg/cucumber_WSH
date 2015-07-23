Scenario Outline: irregular row length
	When add <first>
	And add <second>
	Then sum is <sum>
Examples:
| first | second | sum |
| 3     | 8      | 11  |
| 2     | 1  | 6 | 9   |
| 5     | 5      | 10  |
Finally:
	When reset
 
Scenario Outline: middle syntax error
	When add <first>
	And add <second>
	" And syntax error
	# " 
	Then sum is <sum>
Finally:
	When reset
Examples:
| first | second | sum |
# this one is failed, because previous reset doesn't work
| 3     | 8      | 11  |
| 2     | 6      | 8   |
| 5     | 5      | 10  |
