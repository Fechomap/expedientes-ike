# Guía para Publicar Actualizaciones

Este documento explica cómo gestionar las actualizaciones automáticas para la aplicación IKE Expedientes Automation.

## Requisitos previos

1. Instalar AWS CLI:
   - Para macOS: `brew install awscli`
   - Para Windows: Descargar el instalador desde https://aws.amazon.com/cli/

2. Configurar AWS CLI con credenciales que tengan acceso al bucket S3:
   ```
   aws configure
   ```
   
   Ingresa tus credenciales de AWS cuando se te soliciten:
   - AWS Access Key ID
   - AWS Secret Access Key
   - Default region name (us-east-1)
   - Default output format (json)

3. Asegúrate que el bucket S3 `ike-expedientes-updates` existe:
   ```
   aws s3 ls s3://ike-expedientes-updates/
   ```

## Publicar una nueva versión

Para publicar una nueva versión de la aplicación, sigue estos pasos:

1. Asegúrate de que todos los cambios estén completos y probados localmente.

2. Ejecuta el script para incrementar la versión y publicar:
   ```
   npm run release
   ```

   Este comando:
   - Te pedirá el tipo de actualización (patch, minor, major)
   - Actualizará el número de versión en package.json
   - Construirá la aplicación para macOS
   - Subirá automáticamente los archivos al bucket S3
   - Configurará los permisos adecuados en el bucket

3. Si necesitas publicar para Windows específicamente:
   ```
   node scripts/version-bump.js
   npm run build:win
   node scripts/publish-updates.js
   ```

## Configuración del bucket S3

El bucket S3 debe tener una política que permita acceso público de lectura para que los clientes puedan descargar actualizaciones. Nuestro script `publish-updates.js` intenta configurar esto automáticamente, pero si falla, puedes configurarlo manualmente:

1. Ve a la consola de AWS: https://console.aws.amazon.com/s3/
2. Selecciona el bucket `ike-expedientes-updates`
3. Ve a la pestaña "Permissions"
4. Haz clic en "Bucket Policy"
5. Añade la siguiente política:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadForGetBucketObjects",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::ike-expedientes-updates/*"
    }
  ]
}
```

## Archivos de actualización importantes

Los archivos clave para las actualizaciones son:

- `latest.yml`: Para Windows
- `latest-mac.yml`: Para macOS
- Archivos de instalación (.exe, .dmg)
- Archivos blockmap para actualizaciones parciales

## Solución de problemas

### Las actualizaciones no se detectan

1. Verifica los logs de la aplicación:
   - Windows: `%USERPROFILE%\AppData\Roaming\ike-expedientes-automation\logs`
   - macOS: `~/Library/Logs/ike-expedientes-automation`
   - Linux: `~/.config/ike-expedientes-automation/logs`

2. Asegúrate de que los archivos en S3 sean accesibles públicamente:
   ```
   curl https://ike-expedientes-updates.s3.amazonaws.com/latest-mac.yml
   ```

3. Verifica que los archivos YAML en el bucket tengan la estructura correcta y versiones actualizadas.

### Error al publicar actualizaciones

1. Si recibes errores sobre ACL:
   - El bucket probablemente tiene ACL deshabilitado (configuración moderna de S3)
   - Asegúrate de que la política del bucket permita acceso público de lectura a los objetos

2. Si AWS CLI no está configurado:
   ```
   aws configure
   ```
   
3. Para depurar problemas de permisos:
   ```
   aws s3 ls s3://ike-expedientes-updates/ --debug
   ```