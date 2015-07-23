var sum = 0;
When(/^add (\d+)$/,function(strNum){
	sum += num(strNum);
});
When(/^reset$/,function(){
	sum = 0;
});
Then(/^sum is (\d+)$/,function(strNum){
	// alert('Sum =='+sum);
	return sum == num(strNum);
});