# 1. Configuración de AWS
provider "aws" {
  region = "us-east-1"
}

# 2. Base de Datos (DynamoDB)
resource "aws_dynamodb_table" "tareas_db" {
  name         = "TablaTareasJoanna"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

# 3. AWS Cognito (Autenticación - Capa Gratuita)
resource "aws_cognito_user_pool" "pool" {
  name = "user_pool_tareas"

  # Configuración para que se registren con Email
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Política de contraseñas sencilla para pruebas
  password_policy {
    minimum_length    = 6
    require_lowercase = false
    require_numbers   = false
    require_symbols   = false
    require_uppercase = false
  }
}

resource "aws_cognito_user_pool_client" "client" {
  name         = "react_client_tareas"
  user_pool_id = aws_cognito_user_pool.pool.id
  
  explicit_auth_flows = ["USER_PASSWORD_AUTH"]
}

# 4. Permisos (IAM Role para la Lambda)
resource "aws_iam_role" "iam_lambda" {
  name = "role_lambda_tareas"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy" {
  role       = aws_iam_role.iam_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.iam_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# 5. Función Lambda
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "lambda/index.mjs" 
  output_path = "lambda_function.zip"
}

resource "aws_lambda_function" "crud_lambda" {
  filename      = "lambda_function.zip"
  function_name = "FuncionCRUD_Tareas"
  role          = aws_iam_role.iam_lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.tareas_db.name
    }
  }

  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
}

# 6. API Gateway (HTTP API)
resource "aws_apigatewayv2_api" "api_http" {
  name          = "API-Tareas-Vite"
  protocol_type = "HTTP"
  
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    # IMPORTANTE: Se agregó "authorization" a los headers permitidos
    allow_headers = ["content-type", "authorization"] 
  }
}

# Authorizer de Cognito para proteger rutas
resource "aws_apigatewayv2_authorizer" "cognito_auth" {
  api_id           = aws_apigatewayv2_api.api_http.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-authorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.client.id]
    issuer   = "https://${aws_cognito_user_pool.pool.endpoint}"
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api_http.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "lambda_inst" {
  api_id           = aws_apigatewayv2_api.api_http.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.crud_lambda.invoke_arn
  payload_format_version = "2.0" 
}

# --- RUTAS ---

# GET (Pública: Cualquiera puede ver las tareas)
resource "aws_apigatewayv2_route" "get_tareas" {
  api_id    = aws_apigatewayv2_api.api_http.id
  route_key = "GET /tareas"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_inst.id}"
}

# POST (Protegida)
resource "aws_apigatewayv2_route" "post_tareas" {
  api_id             = aws_apigatewayv2_api.api_http.id
  route_key          = "POST /tareas"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_inst.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_auth.id
}

# DELETE (Protegida)
resource "aws_apigatewayv2_route" "delete_tareas" {
  api_id             = aws_apigatewayv2_api.api_http.id
  route_key          = "DELETE /tareas"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_inst.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_auth.id
}

# PUT (Protegida)
resource "aws_apigatewayv2_route" "put_tareas" {
  api_id             = aws_apigatewayv2_api.api_http.id
  route_key          = "PUT /tareas"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_inst.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_auth.id
}

# Permiso para llamar a la Lambda
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.crud_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api_http.execution_arn}/*/*"
}

# 7. AWS Amplify (Frontend)
variable "github_token" {}

resource "aws_amplify_app" "proyecto_crud" {
  name        = "CRUD-Tareas-Joanna"
  repository  = "https://github.com/al22020463-ai/react-crud-aws2"
  oauth_token = var.github_token

  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - cd frontend
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: frontend/dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
  EOT
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.proyecto_crud.id
  branch_name = "main"
}

# 8. Salidas (Outputs para configurar React)
output "api_url" {
  value = aws_apigatewayv2_api.api_http.api_endpoint
}

output "user_pool_id" {
  value = aws_cognito_user_pool.pool.id
}

output "client_id" {
  value = aws_cognito_user_pool_client.client.id
}

output "region" {
  value = "us-east-1"
}