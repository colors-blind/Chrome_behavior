#!/usr/bin/env python3
"""
生成自签名 SSL 证书用于本地 HTTPS 开发
"""

import os
import sys
from datetime import datetime, timedelta
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

def generate_ssl_cert(cert_dir, key_size=2048, valid_days=365):
    """
    生成自签名 SSL 证书
    
    Args:
        cert_dir: 证书保存目录
        key_size: RSA 密钥大小
        valid_days: 证书有效期（天）
    """
    
    os.makedirs(cert_dir, exist_ok=True)
    
    key_file = os.path.join(cert_dir, "server.key")
    cert_file = os.path.join(cert_dir, "server.crt")
    
    if os.path.exists(key_file) and os.path.exists(cert_file):
        print(f"证书已存在:")
        print(f"  私钥: {key_file}")
        print(f"  证书: {cert_file}")
        return key_file, cert_file
    
    print("=" * 60)
    print("正在生成自签名 SSL 证书...")
    print("=" * 60)
    
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=key_size,
    )
    
    with open(key_file, "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ))
    print(f"私钥已保存: {key_file}")
    
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "CN"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Beijing"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "Beijing"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Local Development"),
        x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
    ])
    
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        private_key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.utcnow()
    ).not_valid_after(
        datetime.utcnow() + timedelta(days=valid_days)
    ).add_extension(
        x509.SubjectAlternativeName([
            x509.DNSName("localhost"),
            x509.IPAddress(__import__('ipaddress').ip_address("127.0.0.1")),
        ]),
        critical=False,
    ).sign(private_key, hashes.SHA256())
    
    with open(cert_file, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    print(f"证书已保存: {cert_file}")
    
    print("=" * 60)
    print("证书生成完成！")
    print("=" * 60)
    print(f"证书有效期: {valid_days} 天")
    print(f"私钥文件: {key_file}")
    print(f"证书文件: {cert_file}")
    print("")
    print("重要提示:")
    print("1. 由于这是自签名证书，浏览器会显示安全警告")
    print("2. 首次访问时需要手动信任该证书")
    print("3. 或者使用 mkcert 工具生成本地信任的证书")
    print("=" * 60)
    
    return key_file, cert_file

if __name__ == "__main__":
    cert_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "certs")
    generate_ssl_cert(cert_dir)
