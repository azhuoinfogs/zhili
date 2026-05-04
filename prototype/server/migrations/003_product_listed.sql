-- B9 后台：商品上下架（1=上架，0=下架）；公开详情不展示下架行（见 productResolve）
ALTER TABLE `product`
  ADD COLUMN `listed` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=上架 0=下架' AFTER `affiliate_url`;
