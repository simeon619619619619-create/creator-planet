<?php

require_once 'Cryptor.php';

$data_array = [
    "orderid" => "0",
    "firstname" => "Тест",
    "lastname" => "Тестов",
    "surname" => "",
    "email" => "ngeorgiev@tbibank.bg",
    "phone" => "0879256031",
    "deliveryaddress" => [
        "country" => "Bulgaria",
        "county" => "",
        "city" => "София",
        "streetname" => "ГМ Димитров",
        "streetno" => "62",
        "buildingno" => "",
        "entranceno" => "",
        "floorno" => "5",
        "apartmentno" => "35",
        "postalcode" => ""
    ],
    "items" => [	
        [
            "name" => "Спортно елегантен панталон",
            "description" => "",
            "qty" => "3",
            "price" => "34.99",
            "sku" => "3345",
            "category" => "255",
            "imagelink" => "https://tbi-uat.online/hat/hat.jpg"
        ],
        [			
            "name" => "Блуза раета",
            "description" => "",
            "qty" => "1",
            "price" => "90.65",
            "sku" => "5566",
            "category" => "255",
            "imagelink" => "https://tbi-uat.online/hat/hat.jpg"
        ]
    ],
		"period" => 34,
    "successRedirectURL" => "https://success.com",
    "failRedirectURL" => "https://fail.com",
];

$json_data = json_encode($data_array);

$encryption_key = 'Ejrg9XF@FqgOvsg3fEgdDAzG5Tce0O42Np2DjONXiQs7FRck6XCf2MP5gC#o4vxOW1qXwlDLpi5v@ArLiK20wWVcfLU!EGnbk6mNq9KgRCs#xX#4aci!69vjjsY#L8ko';
$encrypted_data = Cryptor::Encrypt($json_data,$encryption_key);


$curl = curl_init();
$body = '{
  "reseller_code":"BJKZ",
  "reseller_key":"creatorclub",
  "data":"' . $encrypted_data . '"
}';

curl_setopt_array($curl, array(
  CURLOPT_URL => 'https://beta.tbibank.support/api/RegisterApplication',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_ENCODING => '',
  CURLOPT_MAXREDIRS => 10,
  CURLOPT_TIMEOUT => 5,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
  CURLOPT_CUSTOMREQUEST => 'POST',
  CURLOPT_POSTFIELDS => $body,
  CURLOPT_HTTPHEADER => array(
    'Content-Type: application/json'
  ),
));

$response = curl_exec($curl);

curl_close($curl);
echo $response;

?>