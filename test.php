'
<!DOCTYPE html>
                <html>
                <head>
                <meta charset='UTF-8'>
                    <title>Order Confirmation</title>
                    <style>
                        /* Reset styles for email clients */
                        body, table, td, a, p, h1, h2, h3, h4 { 
                            -webkit-text-size-adjust: 100%;
                            -ms-text-size-adjust: 100%;
                            margin: 0;
                            padding: 0;
                            font-family: 'Arial', sans-serif;
                        }
                        
                        table, td {
                            mso-table-lspace: 0pt;
                            mso-table-rspace: 0pt;
                            border-collapse: collapse !important;
                        }
                        
                        /* Base styles */
                        body {
                            margin: 0;
                            padding: 0;
                            background-color: #f7f7f7;
                            width: 100% !important;
                            height: 100% !important;
                        }
                        
                        /* Container styles */
                        .email-container {
                            max-width: 600px;
                            margin: 0 auto;
                            background-color: #ffffff;
                            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                        }
                        
                        /* Header styles */
                        .header {
                            background: linear-gradient(135deg, #002B5C 0%, #004999 100%);
                            padding: 30px 20px;
                            text-align: center;
                        }
                        
                        .header h1 {
                            color: #ffffff;
                            font-size: 28px;
                            font-weight: 700;
                            margin: 0;
                            line-height: 1.2;
                        }
                        
                        /* Content styles */
                        .content {
                            padding: 40px 30px;
                            background-color: #ffffff;
                        }
                        
                        .greeting {
                            font-size: 18px;
                            color: #333333;
                            margin-bottom: 20px;
                            font-weight: 600;
                        }
                        
                        .message {
                            font-size: 16px;
                            line-height: 1.6;
                            color: #555555;
                            margin-bottom: 25px;
                        }
                        
                        /* Order details styles */
                        .order-details {
                            background-color: #f8f9fa;
                            border-radius: 8px;
                            padding: 20px;
                            margin: 20px 0;
                        }
                        
                        .order-details h2 {
                            color: #002B5C;
                            font-size: 20px;
                            margin-bottom: 15px;
                        }
                        
                        .detail-row {
                            display: block;
                            margin-bottom: 10px;
                            font-size: 15px;
                            color: #444444;
                        }
                        
                        .detail-label {
                            font-weight: 600;
                            color: #333333;
                        }
                        
                        .total-amount {
                            font-size: 18px;
                            color: #002B5C;
                            font-weight: 700;
                            margin-top: 15px;
                            padding-top: 15px;
                            border-top: 2px solid #e9ecef;
                        }
                        
                        /* Footer styles */
                        .footer {
                            background-color: #002B5C;
                            padding: 20px;
                            text-align: center;
                        }
                        
                        .footer p {
                            color: #ffffff;
                            font-size: 14px;
                            margin: 0;
                            opacity: 0.9;
                        }
                        
                        /* Button styles */
                        .cta-button {
                            display: inline-block;
                            padding: 12px 30px;
                            background-color: #002B5C;
                            color: #ffffff;
                            text-decoration: none;
                            border-radius: 6px;
                            font-weight: 600;
                            margin: 20px 0;
                        }
                        
                        /* Responsive styles */
                        @media screen and (max-width: 600px) {
                            .email-container {
                                width: 100% !important;
                            }
                            
                            .content {
                                padding: 30px 20px;
                            }
                            
                            .header h1 {
                                font-size: 24px;
                            }
                        }
                    </style>
                </head>
                <body>
                          <table align='center' border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width:600px;'>

                    <table role='presentation' cellspacing='0' cellpadding='0' border='0' align='center' width='100%' style='max-width: 600px; margin: auto;'>
                        <tr>
                            <td>
                                <table role='presentation' cellspacing='0' cellpadding='0' border='0' width='100%'>
                                    <!-- Header -->
                                    <tr>
                                        <td class='header'>
                                            <h1>Your Laundry Order is Confirmed!</h1>
                                        </td>
                                    </tr>
                                    
                                    <!-- Main Content -->
                                    <tr>
                                        <td class='content'>
                                            <p class='greeting'>Dear <?php echo $name; ?>,</p>
                                            
                                            <p class='message'>
                                                Your payment of <strong>₦<?php echo $total_price; ?></strong> for 
                                                <strong><?php echo $service_name; ?></strong> laundry service has been confirmed.
                                            </p>
                                            
                                            <div class='order-details'>
                                                <h2>Service Details</h2>
                                                <p class='detail-row'>
                                                    <span class='detail-label'>Service Type:</span><br>
                                                    <?php echo $service_name; ?>
                                                </p>
                                                
                                                <p class='detail-row'>
                                                    <span class='detail-label'>Service Fee:</span><br>
                                                    <?php echo $service_fee_breakdown; ?>
                                                </p>
                                                
                                                <p class='detail-row'>
                                                    <span class='detail-label'>Delivery Fee:</span><br>
                                                    ₦<?php echo $delivery_fee; ?>
                                                </p>
                                                
                                                <p class='total-amount'>
                                                    Total Amount Paid: ₦<?php echo $total_price; ?>
                                                </p>
                                            </div>
                                            
                                            <p class='message'>
                                                Our team will contact you shortly to confirm delivery details.
                                            </p>
                                            
                                            <p class='message'>
                                                Thank you for choosing our service!
                                            </p>
                                            
                                            <p class='message'>
                                                Best regards,<br>
                                                <strong><?php echo $sitename; ?> Team</strong>
                                            </p>
                                        </td>
                                    </tr>
                                    
                                    <!-- Footer -->
                                    <tr>
                                        <td class='footer'>
                                            <p>© <?php echo date('Y'); ?> <?php echo $sitename; ?>. All Rights Reserved.</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
                ';