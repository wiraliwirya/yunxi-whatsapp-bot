import fs from 'fs';

const getBuffer = (path) => {
    try {
        return fs.readFileSync(path);
    } catch (e) {
        return Buffer.alloc(0); 
    }
}

const thumbBuffer = getBuffer('./settings/image/thumbnail.jpg');

export const qtext = {
  key: {
    remoteJid: 'status@broadcast',
    fromMe: false,
    participant: '0@s.whatsapp.net'
  },
  message: {
    newsletterAdminInviteMessage: {
      newsletterJid: '120363293494889157@newsletter',
      newsletterName: 'Shiina Hiyori System',
      caption: 'System Notification: Online',
      inviteExpiration: Date.now() + 1814400000
    }
  }
};

export const metaai = {
  key: {
    remoteJid: "status@broadcast",
    fromMe: false,
    id: 'FAKE_ID_META_AI',
    participant: '13135550002@s.whatsapp.net'
  },
  message: {
    contactMessage: {
      displayName: 'Shiina AI / Auto-Response',
      vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;Shiina AI;;;\nFN:Shiina AI\nitem1.TEL;waid=13135550002:+1 313 555 0002\nitem1.X-ABLabel:Main Server\nORG:Shiina Intelligence Division\nEND:VCARD`
    }
  }
};

export const qloc = {
  key: {
    remoteJid: 'status@broadcast',
    fromMe: false,
    participant: '0@s.whatsapp.net'
  },
  message: {
    locationMessage: {
      degreesLatitude: 35.685506,
      degreesLongitude: 139.752706,
      name: 'Server Location: Encrypted',
      address: 'Data Center, Sector 7', 
      url: 'https://pornhub.com'
    }
  }
};

export const qvideo = {
  key: {
    remoteJid: 'status@broadcast',
    fromMe: false,
    participant: '0@s.whatsapp.net'
  },
  message: {
    videoMessage: {
      title: 'ACCESS GRANTED',
      h: 'System verified',
      seconds: 999999999, 
      gifPlayback: 'true',
      caption: 'Execution started...',
      jpegThumbnail: thumbBuffer
    }
  }
};

export const qpay = {
  key: {
    remoteJid: 'status@broadcast',
    fromMe: false,
    participant: '0@s.whatsapp.net'
  },
  message: {
    requestPaymentMessage: {
      currencyCodeIso4217: 'IDR',
      amount1000: 999999999,
      requestFrom: '0@s.whatsapp.net',
      noteMessage: {
        extendedTextMessage: {
          text: 'INVOICE: PREMIUM SCRIPT ACCESS'
        }
      },
      expiryTimestamp: 9999999999,
      amount: {
        value: 999999999,
        offset: 1000,
        currencyCode: 'IDR'
      }
    }
  }
};

export const qpoll = {
  key: {
    remoteJid: 'status@broadcast',
    fromMe: false,
    participant: '0@s.whatsapp.net'
  },
  message: {
    pollCreationMessage: {
      name: "[ SYSTEM STATUS CHECK ]",
      options: [
        { optionName: "Online (Ping: 14ms)" },
        { optionName: "Maintenance Mode" },
        { optionName: "System Failure" }
      ],
      selectableOptionsCount: 1
    }
  }
};

export const qproduct = {
    key: {
        remoteJid: 'status@broadcast',
        fromMe: false,
        participant: '0@s.whatsapp.net'
    },
    message: {
        productMessage: {
            product: {
                productImage: {
                    mimetype: "image/jpeg",
                    jpegThumbnail: thumbBuffer
                },
                title: "Premium Source Code v5.0",
                description: "Full Features, Anti-Ban, Optimized RAM",
                currencyCode: "IDR",
                priceAmount1000: "500000000",
                retailerId: "GHOST_Protocol",
                productImageCount: 1
            },
            businessOwnerJid: "6281234567890@s.whatsapp.net"
        }
    }
};

export const qorder = {
    key: {
        remoteJid: 'status@broadcast',
        fromMe: false,
        participant: '0@s.whatsapp.net'
    },
    message: {
        orderMessage: {
            itemCount: 2025,
            status: 1, // 1 = Pending, 2 = Completed
            surface: 1,
            message: "Order ID: #X-9928-SYSTEM",
            orderTitle: "Database Injection Tool",
            sellerJid: '0@s.whatsapp.net',
            token: "AR7728",
            totalAmount1000: "999999000",
            totalCurrencyCode: "IDR",
            thumbnail: thumbBuffer
        }
    }
};

export const qevent = {
    key: {
        remoteJid: 'status@broadcast',
        fromMe: false,
        participant: '0@s.whatsapp.net'
    },
    message: {
        eventMessage: {
            isCanceled: false,
            name: "Server Maintenance: Kernel Update",
            description: "Upgrading core system to v.2.5. No downtime expected.",
            location: {
                degreesLatitude: 0,
                degreesLongitude: 0,
                name: "Cloud Server SG-1"
            },
            startTime: Date.now(),
            endTime: Date.now() + (1000 * 60 * 60 * 2) // 2 jam dari sekarang
        }
    }
};