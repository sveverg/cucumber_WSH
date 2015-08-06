# cucumber_WSH
Cucumber implementation for JScript(Windows Script Host)

**Pre-alpha version**

#### Basic features support
DSL of this implementation is conceived as fully backward-compatible with the [standard Gherkin](https://cucumber.io/docs/reference#gherkin). However, at present following language elements are not supported:
  * Background section of feature
  * Tags (syntax is supported, but their values are ignored)
  * Two-column data tables (representing key-value pairs)
  
It also requires symbol ':' immediately after `Scenario`-like keywords and has a lot of other minor differences to eliminate.

#### Language enhancements
Current realization provides keyword-driven testing facility: procedures, which serve for action description, can be called from scenarios, as well as from other procedures, and accept arguments from Data Tables. Their description begins with special keyword, right now `GivenProcedure`. Values of table row are accessed with &lt;variables&gt;, like in `Scenario Outline`, but their names can be redefined using keyword `With` and comma separated list of argument names.

``` gherkin
GivenProcedure: Convert books individually
  When select book <name>
  And open window "convert book"
  And focus "dropdown list" with name "Output format"
  And select <format>
  And press "Start"
  
GivenProcedure: Convert books individually(with arguments) With name, format
  When select book <name>
  And open window "convert book"
  And focus "dropdown list" with name "Output format"
  And select <format>
  And press "Start"

Scenario: check updating filtered list
  Given following book list
  | book  | format |
  | book1 | html   |
  | book2 | epub   |
  | book3 | fb2    |
  When filter by format "fb2"
  Then list length should be 1
  
  # value from column "converted_book" is assigned to <name>, from "format" to <format> depending on order
  When Convert books individually(with arguments)
  | converted_book  | format |
  |   book2         | fb2    |
  |   book3         | epub   |
  Then list length should be 1
  
  # that step will raise error, because no column "name" is specified 
  When Convert books individually
  | converted_book  | format |
  |   book1         | epub   |
  |   book2         | epub   |
  |   book3         | pdf    |
  Then list length should be 2
```
Procedures can also accept Doc String, which becomes default argument for any procedure step, that doesn't have its own.

#### Usage
Command line syntax:
`main.js <path to feature file> [/debug:true]`
Script tries to execute feature file, which path is specified in command line. It expects necessary step definitions located in files `steps.js` and `<feature file name>_defs.js`, the first one in project directory and the second one near the feature file. Execution result is printed into StdOut and into `<feature file name>_report.txt`. If option `/debug:true` is specified, report is messed with internal events log.  

This interface is not handy for end users, it has been implemented to simplify manual and automated testing. Alpha version is planned to provide convenient ways of supporting configurable project structure.
