import { buildCardImageDataUrl } from '../utils/adminFormatters';

type CardPreviewData = {
  id: string;
  checkoutName?: string;
  checkoutPhone?: string;
  checkoutExpiryDate?: string;
  checkoutCode?: string;
};

type CardPreviewModalProps = {
  data: CardPreviewData;
  onClose: () => void;
};

export function CardPreviewModal({ data, onClose }: CardPreviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-[9999]"
      style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" style={{ position: 'fixed', inset: 0 }} />
      <img
        src={buildCardImageDataUrl(data.checkoutName, data.checkoutPhone, data.checkoutExpiryDate)}
        alt="信用卡样式图片"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="cursor-pointer rounded border border-white/25 shadow-[0_12px_24px_rgba(0,0,0,0.45)]"
        style={{
          position: 'fixed',
          left: '50vw',
          top: '50vh',
          transform: 'translate(-50%, -50%)',
          width: '480px',
          maxWidth: '480px',
          height: 'auto',
          zIndex: 10000,
        }}
        title="点击卡片关闭"
      />
    </div>
  );
}
