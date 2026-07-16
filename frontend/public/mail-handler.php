<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Honeypot spam check — silently accept so bots don't learn it's blocked
if (!empty($_POST['botcheck'])) {
    echo json_encode(['success' => true]);
    exit;
}

$to = 'hire@boardroomcxo.com';

function clean_field($value) {
    return preg_replace('/[\r\n]+/', ' ', trim((string) $value));
}

$formType = isset($_POST['form_type']) ? clean_field($_POST['form_type']) : 'contact';

if ($formType === 'newsletter') {
    $email = isset($_POST['email']) ? clean_field($_POST['email']) : '';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid email']);
        exit;
    }
    $subject = 'New Newsletter Signup - Boardroom CXO';
    $body = "New newsletter signup:\n\nEmail: {$email}\n";
    $replyTo = $email;
} else {
    $firstName = isset($_POST['first_name']) ? clean_field($_POST['first_name']) : '';
    $lastName  = isset($_POST['last_name']) ? clean_field($_POST['last_name']) : '';
    $email     = isset($_POST['email']) ? clean_field($_POST['email']) : '';
    $phone     = isset($_POST['phone']) ? clean_field($_POST['phone']) : '';
    $company   = isset($_POST['company']) ? clean_field($_POST['company']) : '';
    $role      = isset($_POST['role']) ? clean_field($_POST['role']) : '';
    $service   = isset($_POST['service']) ? clean_field($_POST['service']) : '';
    $message   = isset($_POST['message']) ? trim((string) $_POST['message']) : '';

    if (!$firstName || !$lastName || !filter_var($email, FILTER_VALIDATE_EMAIL) || !$company || !$service) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    $subject = 'New Contact Form Submission - Boardroom CXO';
    $body = "New contact form submission:\n\n"
          . "Name: {$firstName} {$lastName}\n"
          . "Email: {$email}\n"
          . "Phone: {$phone}\n"
          . "Company: {$company}\n"
          . "Role: {$role}\n"
          . "Looking for: {$service}\n\n"
          . "Message:\n{$message}\n";
    $replyTo = $email;
}

$headers = "From: Boardroom CXO Website <no-reply@boardroomcxo.com>\r\n";
$headers .= "Reply-To: {$replyTo}\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$sent = @mail($to, $subject, $body, $headers);

if ($sent) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Mail could not be sent']);
}
