<?php

/* 
	*Prevent direct http access
->move closing comment here to open feature

if(!defined('APPPATH')){
	die('Direct access not permitted');
}
*/

/*
	* Set server precession for float values
->move closing comment here to open feature

ini_set('serialize_precision',"-1");
*/

class tbiSchemes {

	protected $reseller_code;
	protected $reseller_key;
	
	public $amount;
	public $downpayment;
	public $category_id;

	public $schemes = array();

	public function __construct($amount="",$downpayment=0,$category_id="") {
		$this->amount = $amount;
		$this->downpayment = $downpayment;
		$this->category_id = $category_id;
		$this->reseller_code = 'TBI1';
		$this->reseller_key = 'Tbi123';
	}

	protected function GetSchemesFromServer(){

		try {
			$data = [	'reseller_code' => $this->reseller_code,
						'reseller_key' => $this->reseller_key,
						'amount' => $this->amount,
						'category_id' => $this->category_id
					];

			$request = json_encode($data);

			$ch = curl_init();
			curl_setopt_array($ch, array(
			                    CURLOPT_URL => "https://beta.tbibank.support/api/GetCalculations",
			                     CURLOPT_RETURNTRANSFER => true,
			                    CURLOPT_ENCODING => "",
			                    CURLOPT_MAXREDIRS => 10,
			                    CURLOPT_TIMEOUT => 0,
			                    CURLOPT_FOLLOWLOCATION => true,
			                    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
			                    CURLOPT_CUSTOMREQUEST => "POST",
			                    CURLOPT_POSTFIELDS => $request,
			                    CURLOPT_HTTPHEADER => array(
			                        "Content-Type: application/json",
			                    ),
			                ));

			curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
			$server_output = curl_exec($ch);
			$error = curl_error($ch);
			curl_close($ch);
			return json_decode($server_output);
		}
		catch(Exception $e){
			throw new Exception("Could not get schemes. ".$e->getMessage());   
		}
	}

	public function UpdateSchemes(){
		try {
			$schemes = json_encode($this->GetSchemesFromServer(),  JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
			$myfile = fopen("tbischemes.json", "w");
			fwrite($myfile, $schemes);
			fclose($myfile);
			/* 
				In order to use it easily a better aproach is to store all schemes in a database
			*/
		}
		catch(Exception $e){
			throw new Exception("Could not update schemes. ".$e->getMessage());   
		}
	}

	public function ListSchemes(){
		try {
			header('Content-Type: application/json; charset=utf-8');
			$myfile = fopen("tbischemes.json", "r");
			$schemes =  json_decode( fread($myfile,filesize("tbischemes.json")) );
			fclose($myfile);
			echo json_encode($schemes,  JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
			/* 
				Best aproach is to get schemes filtered by min/max ammount and category_is from the database
			*/
		}
		catch(Exception $e){
			throw new Exception("Could not list schemes. ".$e->getMessage());   
		}
	}

	public function GetReadyTable($amount="",$downpayment=0,$category_id=""){

		$loan_amount = $amount - $downpayment;
		$this->amount = $loan_amount;
		$this->downpayment = $downpayment;
		$this->category_id = $category_id;

		echo '
		<h2>Checkout price: '.$amount.' BGN</h2>
		<h3>Downpayment/Initial payment: '.$downpayment.' BGN</h3>
		<h4>ID category: '.$category_id.'</h4>
		<table cellpadding="10" border="1">
		<tr>
			<td>id</td>
			<td>Scheme name</td>
			<td>Period</td>
			<td>Monthly installment</td>
			<td>Total due amount</td>
			<td>NIR</td>
			<td>APR</td>
		</tr>
		';

		$schemes = $this->GetSchemesFromServer();
		foreach($schemes as $scheme){

			$monthly_installment = number_format($scheme->installment_factor*$loan_amount,2,".","");
			$total_due = $monthly_installment*$scheme->period;
			echo '
				<tr>
					<td>'.$scheme->id.'</td>
					<td>'.$scheme->name.'</td>
					<td>'.$scheme->period.'</td>
					<td>'.$monthly_installment.' BGN</td>
					<td>'.$total_due.' BGN</td>
					<td>'.number_format($scheme->nir,2).' %</td>
					<td>'.number_format($scheme->apr,2).' %</td>
				</tr>
			';

		}
		echo '</table>';
	}

}
echo '<h1>Repayment plans/schemes</h1>';
$schemes = new tbiSchemes;
$schemes->GetReadyTable(1000,20,333);
$schemes->GetReadyTable(1500,0,255);
$schemes->GetReadyTable(5100,200);
$schemes->GetReadyTable(5100);
$schemes->GetReadyTable(20000);